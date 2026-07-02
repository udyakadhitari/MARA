# MARA API Reference (Backend Route Specifications)

This document defines the REST and Server-Sent Events (SSE) API specification for the **Multi-Agent Research Agent (MARA)** backend, exposing routes for research orchestration, streaming traces, history, and system configurations.

---

## 1. Authentication
Currently, no authentication is specified. For production, routes should be secured behind a standard bearer token or session cookie.

---

## 2. API Endpoints

### 2.1 Start Research Task
Initiates a new research workflow using the multi-agent orchestrator.

*   **URL**: `/api/research/run`
*   **Method**: `POST`
*   **Request Headers**: `Content-Type: application/json`
*   **Request Body**:
    ```json
    {
      "query": "Latest breakthroughs in solid-state batteries",
      "model_id": "GEMINI_3_1_PRO"
    }
    ```
*   **Success Response**:
    *   **Status Code**: `202 Accepted`
    *   **Response Body**:
        ```json
        {
          "task_id": "res_8f7b2c9a1d4e",
          "query": "Latest breakthroughs in solid-state batteries",
          "status": "PENDING"
        }
        ```

---

### 2.2 Stream Research Progress (SSE)
Establishes a Server-Sent Events (SSE) connection to stream real-time logs, agent thoughts (trace), source citations, errors, and the final response text chunks.

*   **URL**: `/api/research/stream/{task_id}`
*   **Method**: `GET`
*   **Request Headers**: `Accept: text/event-stream`
*   **Response Headers**: 
    *   `Content-Type: text/event-stream`
    *   `Cache-Control: no-cache`
    *   `Connection: keep-alive`

#### SSE Event Types & Payloads:

##### A. Event: `status`
Fired when the global task state changes or updates sub-query progress.
*   **Data Payload**:
    ```json
    {
      "task_id": "res_8f7b2c9a1d4e",
      "status": "RUNNING",
      "active_step": "scrape",
      "progress": {
        "completed_queries": 4,
        "total_queries": 5
      }
    }
    ```

##### B. Event: `trace`
Fired when any agent (Orchestrator, Search, Scraper, Verifier, Synthesizer) logs a new thought, action, or output.
*   **Data Payload**:
    ```json
    {
      "step_id": "step_scrape_03",
      "agent": "Scraper",
      "status": "RUNNING",
      "message": "Extracting content (3/5 sources)",
      "percentage": 60,
      "metadata": {
        "urls_processed": [
          "nature.com/articles/s41560...",
          "sciencedirect.com/science/..."
        ]
      }
    }
    ```

##### C. Event: `text`
Fired when the Synthesizer streams the final markdown research response text chunk-by-chunk.
*   **Data Payload**:
    ```json
    {
      "chunk": "Recent breakthroughs in solid-state battery (SSB) technology..."
    }
    ```

##### D. Event: `source`
Fired when a search/scrape agent finds and verifies a cited source.
*   **Data Payload**:
    ```json
    {
      "id": 1,
      "title": "Interfacial Engineering in Sulfide Solid-State Batteries",
      "url": "https://nature.com/articles/s41560-example",
      "publication": "Journal of Power Sources (2024)",
      "summary": "Analysis of space-charge layers and LiNbO3 coatings on NMC cathodes.",
      "relevance": 95
    }
    ```

##### E. Event: `error`
Fired when a non-fatal error occurs (e.g. rate limits or scrape timeouts) that allows retrying.
*   **Data Payload**:
    ```json
    {
      "error_code": "SCRAPE_TIMEOUT",
      "message": "Error fetching arxiv.org/abs/2401.12345 (Timeout)",
      "target_step": "step_scrape_05",
      "retryable": true
    }
    ```

##### F. Event: `complete`
Fired when the synthesis is complete and the connection is closing.
*   **Data Payload**:
    ```json
    {
      "task_id": "res_8f7b2c9a1d4e",
      "status": "COMPLETED",
      "final_length": 4256
    }
    ```

---

### 2.3 Fetch Research Task Details
Retrieves the complete cached output and steps of a research task after it finishes.

*   **URL**: `/api/research/task/{task_id}`
*   **Method**: `GET`
*   **Success Response**:
    *   **Status Code**: `200 OK`
    *   **Response Body**:
        ```json
        {
          "task_id": "res_8f7b2c9a1d4e",
          "query": "Latest breakthroughs in solid-state batteries",
          "status": "COMPLETED",
          "markdown_response": "# Recent Advancements in Solid-State Batteries...",
          "sources": [
            {
              "id": 1,
              "title": "Interfacial Engineering in Sulfide Solid-State Batteries",
              "url": "https://nature.com/articles/s41560-example",
              "publication": "Journal of Power Sources (2024)",
              "relevance": 95
            }
          ],
          "traces": [
            {
              "agent": "Orchestrator",
              "message": "Decomposed into 5 sub-queries",
              "status": "COMPLETED"
            }
          ]
        }
        ```

---

### 2.4 Retry Step
Forces a specific failed agent step to retry execution.

*   **URL**: `/api/research/retry-step`
*   **Method**: `POST`
*   **Request Body**:
    ```json
    {
      "task_id": "res_8f7b2c9a1d4e",
      "step_id": "step_scrape_05"
    }
    ```
*   **Success Response**:
    *   **Status Code**: `200 OK`
    *   **Response Body**:
        ```json
        {
          "status": "RETRY_INGESTED",
          "step_id": "step_scrape_05"
        }
        ```

---

### 2.5 Fetch Research History
Lists previously executed research queries.

*   **URL**: `/api/research/history`
*   **Method**: `GET`
*   **Success Response**:
    *   **Status Code**: `200 OK`
    *   **Response Body**:
        ```json
        [
          {
            "task_id": "res_8f7b2c9a1d4e",
            "query": "Latest breakthroughs in solid-state batteries",
            "timestamp": "2026-07-02T12:00:00Z",
            "status": "COMPLETED"
          },
          {
            "task_id": "res_2b5d4e1f7c8a",
            "query": "Impact of LLMs on urban planning",
            "timestamp": "2026-07-02T10:15:00Z",
            "status": "COMPLETED"
          }
        ]
        ```

---

### 2.6 Fetch Settings
Retrieves current global settings for the research system.

*   **URL**: `/api/settings`
*   **Method**: `GET`
*   **Success Response**:
    *   **Status Code**: `200 OK`
    *   **Response Body**:
        ```json
        {
          "default_model": "GEMINI_3_1_PRO",
          "temperature": 0.2,
          "max_search_results": 10,
          "scraping_depth": "DEEP"
        }
        ```

---

### 2.7 Update Settings
Updates global research system configurations.

*   **URL**: `/api/settings`
*   **Method**: `POST`
*   **Request Body**:
    ```json
    {
      "default_model": "GEMINI_3_1_PRO",
      "temperature": 0.3,
      "max_search_results": 15
    }
    ```
*   **Success Response**:
    *   **Status Code**: `200 OK`
    *   **Response Body**:
        ```json
        {
          "status": "SETTINGS_UPDATED",
          "settings": {
            "default_model": "GEMINI_3_1_PRO",
            "temperature": 0.3,
            "max_search_results": 15,
            "scraping_depth": "DEEP"
          }
        }
        ```
