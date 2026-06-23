import asyncio
from pipeline import run_pipeline, create_job, JOBS
import logging

logging.basicConfig(level=logging.DEBUG)

async def main():
    job_id = create_job()
    await run_pipeline('393633044', None, job_id)
    res = JOBS[job_id]["result"]
    print("Method:", res.get("method"))
    print("Class:", res.get("classification"))
    print("Conf:", res.get("confidence"))

asyncio.run(main())
