import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import { buildSankeyFunnel } from '../utils/sankeyFunnel.js';

const config = {
  displayModeBar: false,
  responsive: true,
};

function readPlotWidth(plotEl, chartEl) {
  const plotWidth = plotEl?.clientWidth ?? 0;
  const chartWidth = chartEl?.clientWidth ?? 0;
  return Math.round(Math.max(plotWidth, chartWidth));
}

function buildLayout(chartHeight, width) {
  const textColor =
    getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() ||
    '#1a1a2e';

  return {
    font: {
      family: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      size: 13,
      color: textColor,
    },
    margin: { l: 96, r: 112, t: 16, b: 36 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    autosize: true,
    width,
    height: chartHeight,
  };
}

export default function FunnelSankey({ applications }) {
  const chartRef = useRef(null);
  const plotRef = useRef(null);
  const renderedWidthRef = useRef(0);
  const funnel = useMemo(() => buildSankeyFunnel(applications), [applications]);

  useLayoutEffect(() => {
    const plotEl = plotRef.current;
    const chartEl = chartRef.current;
    if (!plotEl || !funnel.hasFlows) return undefined;

    let cancelled = false;
    renderedWidthRef.current = 0;

    const drawPlot = (source) => {
      if (cancelled) return Promise.resolve();

      const width = readPlotWidth(plotEl, chartEl);
      if (width <= 0) return Promise.resolve();

      const layout = buildLayout(funnel.chartHeight, width);

      return Plotly.react(plotEl, [funnel.trace], layout, config).then(() => {
        if (cancelled) return;
        renderedWidthRef.current = width;
        Plotly.Plots.resize(plotEl);
      });
    };

    const tryDraw = (source) => {
      const width = readPlotWidth(plotEl, chartEl);
      if (width <= 0) return;

      if (source !== 'initial' && Math.abs(width - renderedWidthRef.current) < 2) {
        return;
      }

      drawPlot(source);
    };

    const scheduleInitialDraw = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) tryDraw('initial');
        });
      });
    };

    scheduleInitialDraw();

    const handleResize = () => tryDraw('ResizeObserver');
    const handleWindowResize = () => tryDraw('window.resize');

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartEl ?? plotEl);
    resizeObserver.observe(plotEl);
    window.addEventListener('resize', handleWindowResize);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [funnel]);

  useEffect(
    () => () => {
      const plotEl = plotRef.current;
      if (plotEl) Plotly.purge(plotEl);
    },
    [],
  );

  if (!funnel.hasFlows) {
    return (
      <div className="sankey-empty">
        <p className="page__text page__text--muted">
          No applications to build the funnel yet. Add applications and the chart will
          update automatically.
        </p>
      </div>
    );
  }

  return (
    <div ref={chartRef} className="sankey-chart">
      <div
        ref={plotRef}
        className="sankey-chart__plot"
        style={{ height: funnel.chartHeight }}
      />
      <p className="sankey-caption page__text--muted">
        Total applications: {funnel.total}
      </p>
    </div>
  );
}
