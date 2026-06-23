import asyncio
from pipeline import run_pipeline, create_job, JOBS

async def main():
    job_id = create_job()
    await run_pipeline('393633044', None, job_id)
    print("FEATURES:", JOBS[job_id]["result"])

asyncio.run(main())
