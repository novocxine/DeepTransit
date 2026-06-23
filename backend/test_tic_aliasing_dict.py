import asyncio
from detect import check_period_aliasing
from pipeline import JOBS, create_job, run_pipeline

async def main():
    job_id = create_job()
    await run_pipeline('393633044', None, job_id)
    # The pipeline prints the dict? No, we didn't save it.
    pass

asyncio.run(main())
