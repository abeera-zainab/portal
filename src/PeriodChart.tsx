import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type PeriodRow = Record<string, string | number>;

export type PeriodBar = {
  key: string;
  name: string;
  color: string;
};

const GREEN = "#1f6b4a";
const AMBER = "#9a5b12";
const LEAVE = "#1d4e89";
const MUTED = "#8a8178";
const HOLIDAY = "#3d6b7a";

const tooltipStyle = {
  background: "#fffdf8",
  border: "1px solid #e4d9c8",
  borderRadius: 12,
  fontSize: 13,
};

export const ATTENDANCE_BARS: PeriodBar[] = [
  { key: "onTime", name: "On time", color: GREEN },
  { key: "late", name: "Late", color: AMBER },
  { key: "leave", name: "On leave", color: LEAVE },
  { key: "weekend", name: "Weekend", color: HOLIDAY },
  { key: "absent", name: "Absent", color: MUTED },
];

export function PeriodChart({
  data,
  bars,
  trendKey,
  trendName,
  trendColor = GREEN,
  onBarClick,
}: {
  data: PeriodRow[];
  bars: PeriodBar[];
  trendKey: string;
  trendName: string;
  trendColor?: string;
  onBarClick?: (key: string, row: PeriodRow) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} barCategoryGap="22%">
        <CartesianGrid stroke="#e4d9c8" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: "#6d645b", fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fill: "#6d645b", fontSize: 12 }} width={32} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend />
        {bars.map((bar) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.name}
            fill={bar.color}
            maxBarSize={22}
            cursor={onBarClick ? "pointer" : undefined}
            onClick={
              onBarClick
                ? (item: { payload?: PeriodRow }) => {
                    if (item.payload) onBarClick(bar.key, item.payload);
                  }
                : undefined
            }
          />
        ))}
        <Line
          type="monotone"
          dataKey={trendKey}
          name={trendName}
          stroke={trendColor}
          strokeWidth={2}
          dot={{ r: 4, fill: trendColor, stroke: trendColor }}
          activeDot={{ r: 6 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
