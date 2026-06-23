import asyncio
from pipeline import run_pipeline, create_job, JOBS

async def main():
    job_id = create_job()
    await run_pipeline('393633044', None, job_id)
    print("FINISHED")
    print(JOBS[job_id]["result"]["description"])

asyncio.run(main())
