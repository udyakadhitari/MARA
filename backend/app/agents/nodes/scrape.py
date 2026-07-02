from typing import Dict, Any
import socket
import ipaddress
import re
from urllib.parse import urlparse
import httpx
from bs4 import BeautifulSoup
from ..state import AgentState

def is_safe_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            print(f"SSRF Prevention: Blocked non-http/s scheme in URL: {url}")
            return False
            
        hostname = parsed.hostname
        if not hostname:
            print(f"SSRF Prevention: No hostname found for URL: {url}")
            return False
            
        # Resolve hostname to get all IP addresses (IPv4 & IPv6)
        addr_info = socket.getaddrinfo(hostname, None)
        for info in addr_info:
            ip_str = info[4][0]
            # Strip scope identifier from IPv6 addresses if present
            if "%" in ip_str:
                ip_str = ip_str.split("%")[0]
            ip = ipaddress.ip_address(ip_str)
            
            # Block private, loopback, link-local, or unspecified ranges
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_unspecified:
                print(f"SSRF Prevention: Blocked access to local/private IP {ip_str} for URL: {url}")
                return False
        return True
    except Exception as e:
        print(f"SSRF Prevention: Check failed for URL {url}: {e}")
        return False

def sanitize_scraped_text(text: str) -> str:
    # Identify and redact phrases commonly associated with prompt injection instructions
    injection_patterns = [
        (r"(?i)ignore\s+(?:all\s+)?previous\s+instructions", "[REDACTED INSTRUCTION DIRECTIVE]"),
        (r"(?i)system\s+override", "[REDACTED INSTRUCTION DIRECTIVE]"),
        (r"(?i)you\s+must\s+now", "[REDACTED INSTRUCTION DIRECTIVE]"),
        (r"(?i)new\s+instructions\s+are", "[REDACTED INSTRUCTION DIRECTIVE]"),
        (r"(?i)forget\s+what\s+you\s+were\s+doing", "[REDACTED INSTRUCTION DIRECTIVE]"),
        (r"(?i)start\s+acting\s+as\s+a", "[REDACTED INSTRUCTION DIRECTIVE]")
    ]
    sanitized = text
    for pattern, replacement in injection_patterns:
        sanitized = re.sub(pattern, replacement, sanitized)
    return sanitized

def scrape_node(state: AgentState) -> Dict[str, Any]:
    print("\n--- [Scrape Node] Scraping and Cleaning Found URLs ---")
    search_results = state["search_results"]
    scraped_content = {}
    
    unique_urls = set()
    for urls in search_results.values():
        unique_urls.update(urls)
        
    if not unique_urls:
        print("No URLs to scrape.")
        return {"scraped_content": {}}
        
    print(f"Total unique URLs to scrape: {len(unique_urls)}")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    from ..cache import scrape_cache
    
    with httpx.Client(headers=headers, timeout=5.0, follow_redirects=True) as client:
        for url in unique_urls:
            # 1. Enforce SSRF protection check before any fetch
            if not is_safe_url(url):
                print(f"  Blocked URL (SSRF Risk): {url}")
                scraped_content[url] = {
                    "title": "Blocked (SSRF Prevention)",
                    "content": "Access to this address is blocked for security reasons.",
                    "status": "failed"
                }
                continue

            # 2. Check cache
            cached_page = scrape_cache.get(url)
            if cached_page is not None:
                print(f"[Cache Hit] Using cached scraped content for URL: {url}")
                scraped_content[url] = cached_page
                continue

            print(f"Scraping: {url}...")
            try:
                response = client.get(url)
                if response.status_code != 200:
                    print(f"  Failed status code: {response.status_code}")
                    scraped_content[url] = {
                        "title": "Unavailable",
                        "content": f"HTTP status error: {response.status_code}",
                        "status": "failed"
                    }
                    continue
                    
                soup = BeautifulSoup(response.text, "html.parser")
                
                for tag in soup(["script", "style", "header", "footer", "nav", "noscript"]):
                    tag.decompose()
                    
                title = soup.title.string.strip() if soup.title else "Untitled Page"
                
                text_lines = [line.strip() for line in soup.get_text().splitlines()]
                clean_text = "\n".join(line for line in text_lines if line)
                clean_text = clean_text[:4000]
                
                # 3. Sanitize against prompt overrides/injections
                clean_text = sanitize_scraped_text(clean_text)
                
                scraped_content[url] = {
                    "title": title,
                    "content": clean_text,
                    "status": "success"
                }
                scrape_cache.set(url, scraped_content[url])
                print(f"  Successfully scraped: '{title}' ({len(clean_text)} chars)")
                
            except Exception as e:
                print(f"  Scrape failed for {url}: {e}")
                scraped_content[url] = {
                    "title": "Failed to scrape",
                    "content": str(e),
                    "status": "failed"
                }
                
    return {"scraped_content": scraped_content}
