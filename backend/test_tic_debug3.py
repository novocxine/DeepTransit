import asyncio
from pipeline import run_pipeline, create_job, JOBS

async def main():
    job_id = create_job()
    await run_pipeline('393633044', None, job_id)
    res = JOBS[job_id]["result"]
    print("depth:", res.get("depth"))
    print("snr:", res.get("snr"))
    print("odd_even_ratio:", res.get("odd_even_ratio"))
    print("secondary_depth:", res.get("secondary_depth"))
    print("duration:", res.get("duration"))
    print("period:", res.get("period"))

asyncio.run(main())
