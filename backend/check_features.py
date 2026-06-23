import asyncio
from utils.ingest import download_lightcurve
from utils.preprocess import detrend_and_normalize
from utils.detect import run_bls, check_period_aliasing

async def main():
    for tic_id in ["171638200", "393633044"]:
        lc_data = download_lightcurve(tic_id, None)
        time_flat, flux_flat, flux_err_flat, _ = detrend_and_normalize(
            lc_data["time"], lc_data["flux"], lc_data["flux_err"]
        )
        bls = run_bls(time_flat, flux_flat, flux_err_flat)
        bls = check_period_aliasing(time_flat, flux_flat, bls)
        print(f"TIC {tic_id}: depth={bls['depth']*1e6:.0f} ppm, SNR={bls['snr']:.1f}, odd_even={bls['odd_even_ratio']:.3f}, aliased={bls.get('period_aliasing_flag', False)}")

if __name__ == "__main__":
    asyncio.run(main())
