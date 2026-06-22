import asyncio
from pipeline import run_pipeline

async def test():
    result = await run_pipeline("278822952", 1, "test_job")
    print("PIPELINE RESULT CLASSIFICATION:", result["classification"], result["confidence"])

asyncio.run(test())
