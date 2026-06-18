"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with plotly
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// Shared dark theme for all charts
export const PLOTLY_DARK_LAYOUT: Record<string, any> = {
  paper_bgcolor: "#0d1117",
  plot_bgcolor: "#0d1117",
  font: { color: "#c9d1d9", family: "JetBrains Mono, monospace", size: 11 },
  xaxis: {
    gridcolor: "#21262d",
    zerolinecolor: "#30363d",
    tickcolor: "#8b949e",
    tickfont: { color: "#8b949e", size: 10 },
    titlefont: { color: "#8b949e", size: 11 },
    linecolor: "#30363d",
  },
  yaxis: {
    gridcolor: "#21262d",
    zerolinecolor: "#30363d",
    tickcolor: "#8b949e",
    tickfont: { color: "#8b949e", size: 10 },
    titlefont: { color: "#8b949e", size: 11 },
    linecolor: "#30363d",
  },
  legend: {
    bgcolor: "rgba(22,27,34,0.8)",
    bordercolor: "#30363d",
    borderwidth: 1,
    font: { color: "#c9d1d9", size: 10 },
  },
  margin: { t: 36, r: 20, b: 50, l: 60 },
  hovermode: "x unified",
  hoverlabel: {
    bgcolor: "#161b22",
    bordercolor: "#30363d",
    font: { color: "#c9d1d9", family: "JetBrains Mono, monospace", size: 11 },
  },
};

const PLOTLY_CONFIG: Record<string, any> = {
  displayModeBar: true,
  modeBarButtonsToRemove: [
    "sendDataToCloud",
    "editInChartStudio",
    "lasso2d",
    "select2d",
    "toggleSpikelines",
  ],
  displaylogo: false,
  responsive: true,
  toImageButtonOptions: {
    format: "png",
    scale: 2,
    filename: "astrodetect_chart",
  },
};

interface PlotlyChartProps {
  data: any[];
  layout?: Record<string, any>;
  title?: string;
  height?: number;
  className?: string;
}

export default function PlotlyChart({
  data,
  layout = {},
  title,
  height = 350,
  className = "",
}: PlotlyChartProps) {
  const mergedLayout: Record<string, any> = {
    ...PLOTLY_DARK_LAYOUT,
    ...layout,
    title: title
      ? {
          text: title,
          font: { color: "#58a6ff", size: 13, family: "JetBrains Mono, monospace" },
          x: 0.02,
          xanchor: "left",
        }
      : undefined,
    height,
    xaxis: {
      ...PLOTLY_DARK_LAYOUT.xaxis,
      ...(layout.xaxis || {}),
    },
    yaxis: {
      ...PLOTLY_DARK_LAYOUT.yaxis,
      ...(layout.yaxis || {}),
    },
  };

  return (
    <div className={`w-full overflow-hidden rounded-lg ${className}`}>
      <Plot
        data={data}
        layout={mergedLayout}
        config={PLOTLY_CONFIG}
        style={{ width: "100%", height }}
        useResizeHandler
      />
    </div>
  );
}
