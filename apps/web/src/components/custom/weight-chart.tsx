'use client';

const CHART_HEIGHT = 200;
const CHART_WIDTH = 400;
const PADDING = { top: 20, right: 20, bottom: 40, left: 40 };
const WEIGHT_PADDING = 2;
const POINT_RADIUS = 4;

interface WeightChartProps {
  data: Array<{ date: string; weightKg: number }>;
}

const getInnerDimensions = () => ({
  width: CHART_WIDTH - PADDING.left - PADDING.right,
  height: CHART_HEIGHT - PADDING.top - PADDING.bottom,
});

const computeRange = (data: Array<{ weightKg: number }>) => {
  const weights = data.map((d) => d.weightKg);
  const min = Math.min(...weights) - WEIGHT_PADDING;
  const max = Math.max(...weights) + WEIGHT_PADDING;
  return { min, max };
};

const toX = (index: number, total: number, innerWidth: number): number => {
  if (total <= 1) return innerWidth / 2;
  return (index / (total - 1)) * innerWidth;
};

const toY = (weightKg: number, min: number, max: number, innerHeight: number): number => {
  const ratio = (weightKg - min) / (max - min);
  return innerHeight - ratio * innerHeight;
};

const buildPolylinePoints = (
  data: Array<{ weightKg: number }>,
  min: number,
  max: number,
  innerWidth: number,
  innerHeight: number,
): string =>
  data
    .map((d, i) => `${toX(i, data.length, innerWidth)},${toY(d.weightKg, min, max, innerHeight)}`)
    .join(' ');

const formatDate = (dateStr: string): string => {
  const [, month, day] = dateStr.split('-');
  return `${day}/${month}`;
};

const EmptyState = () => (
  <div
    className="flex items-center justify-center rounded-xl border border-dashed"
    style={{ height: CHART_HEIGHT }}
  >
    <p className="text-muted-foreground text-sm">Nessun dato disponibile</p>
  </div>
);

const XAxisLabels = ({
  data,
  innerWidth,
  innerHeight,
}: {
  data: Array<{ date: string }>;
  innerWidth: number;
  innerHeight: number;
}) => {
  const step = Math.ceil(data.length / 5);
  const visible = data
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => index % step === 0 || index === data.length - 1);
  return (
    <>
      {visible.map(({ item, index }) => {
        const x = toX(index, data.length, innerWidth);
        return (
          <text
            key={item.date}
            x={x}
            y={innerHeight + 20}
            textAnchor="middle"
            fontSize={10}
            className="fill-muted-foreground"
          >
            {formatDate(item.date)}
          </text>
        );
      })}
    </>
  );
};

const YAxisLabels = ({
  min,
  max,
  innerHeight,
}: {
  min: number;
  max: number;
  innerHeight: number;
}) => {
  const ticks = [min + WEIGHT_PADDING, (min + max) / 2, max - WEIGHT_PADDING];
  return (
    <>
      {ticks.map((val, idx) => {
        const y = toY(val, min, max, innerHeight);
        return (
          <text
            key={idx}
            x={-8}
            y={y}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={10}
            className="fill-muted-foreground"
          >
            {val.toFixed(1)}
          </text>
        );
      })}
    </>
  );
};

const DataPoints = ({
  data,
  min,
  max,
  innerWidth,
  innerHeight,
}: {
  data: Array<{ date: string; weightKg: number }>;
  min: number;
  max: number;
  innerWidth: number;
  innerHeight: number;
}) => (
  <>
    {data.map((d, i) => (
      <circle
        key={d.date}
        cx={toX(i, data.length, innerWidth)}
        cy={toY(d.weightKg, min, max, innerHeight)}
        r={POINT_RADIUS}
        className="fill-primary stroke-background"
        strokeWidth={2}
      />
    ))}
  </>
);

const WeightChart = ({ data }: WeightChartProps) => {
  if (data.length === 0) return <EmptyState />;

  const { width: innerWidth, height: innerHeight } = getInnerDimensions();
  const { min, max } = computeRange(data);
  const points = buildPolylinePoints(data, min, max, innerWidth, innerHeight);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
        aria-label="Grafico peso nel tempo"
        role="img"
      >
        <g transform={`translate(${PADDING.left}, ${PADDING.top})`}>
          <polyline
            points={points}
            fill="none"
            strokeWidth={2}
            className="stroke-primary"
          />
          <XAxisLabels data={data} innerWidth={innerWidth} innerHeight={innerHeight} />
          <YAxisLabels min={min} max={max} innerHeight={innerHeight} />
          <DataPoints data={data} min={min} max={max} innerWidth={innerWidth} innerHeight={innerHeight} />
        </g>
      </svg>
    </div>
  );
};

export default WeightChart;
