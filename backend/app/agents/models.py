from pydantic import BaseModel, Field
from typing import List

class SubQueryModel(BaseModel):
    query: str = Field(description="A specific, focused sub-question derived from the main query.")
    needs_search: bool = Field(description="True if this query requires searching the web for real-time information. False if it is a general concept, synthesis request, or general knowledge that can be answered directly.")

class DecomposedQueries(BaseModel):
    sub_queries: List[SubQueryModel] = Field(description="A list of 2 to 4 sub-queries that cover different facets of the main query.")

class ClaimModel(BaseModel):
    claim_text: str = Field(description="A specific factual claim made in the report.")
    source_url: str = Field(description="The source URL from the scraped content that directly supports this claim. If no URL supports it, leave empty.")

class SynthesizedAnswerModel(BaseModel):
    answer_text: str = Field(description="The comprehensive research report answer in markdown format.")
    claims: List[ClaimModel] = Field(description="A list of key claims extracted from the answer, each mapped to the URL that supports it.")
    confidence: float = Field(description="Self-rated confidence score between 0.0 and 1.0 based on available sources.")
    follow_up_questions: List[str] = Field(description="A list of exactly 3 relevant follow-up questions for deeper research based on the findings.")

class CriticVerdictModel(BaseModel):
    verdict: str = Field(description="Must be either 'pass' or 'fail'. Output 'pass' only if all claims are verified by the source text, otherwise 'fail'.")
    feedback: str = Field(description="If verdict is 'fail', list the exact claims that failed verification and the reasons why (e.g. contradiction, no supporting evidence). If 'pass', provide a short confirmation.")
