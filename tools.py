from openai import api_key
from openai import OpenAI
from tavily import TavilyClient
from rich import print 
from dotenv import load_dotenv
import os
import requests
from bs4 import BeautifulSoup
from langchain.tools import tool




load_dotenv()




tavily = TavilyClient(api_key =os.getenv("TAVILY_API_KEY") )

@tool
def webSearch(query:str) -> str:
    """Search the web for information using Tavily."""
    results = tavily.search(query, max_results=5)

    out = []

    for r in results['results']:
        out.append(
            f"Title : {r["title"]}\nURL : {r["url"]}\nSnippet : {r["content"][:300]}\n"
        )

    return "\n----\n".join(out)



@tool
def scrape_url(url: str) -> str:
    """Fetch the content of a web page URL and extract clean, readable plain text."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Remove navigation, footer, script, and style elements to keep only the main content
        for element in soup(["script", "style", "nav", "footer", "header", "iframe", "aside"]):
            element.decompose()
            
        # Get text and clean up whitespace
        text = soup.get_text(separator="\n")
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        clean_text = "\n".join(chunk for chunk in chunks if chunk)
        
        return clean_text
    except Exception as e:
        return f"Error fetching URL: {str(e)}"


# Test the new tool
print("--- Testing webSearch ---")
search_results = webSearch.invoke("whats the news on iran vs usa war")
print(search_results)

# Test getCleanTextFromUrl with one of the search results or a sample URL
print("\n--- Testing getCleanTextFromUrl ---")
url_to_test = "https://www.bbc.com/news/live/cx297218m9vt"
print(f"Fetching from: {url_to_test}")
print(scrape_url.invoke(url_to_test)[:3000])  # Show first 1000 chars of the text



