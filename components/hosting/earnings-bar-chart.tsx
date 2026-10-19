"use client";

import { MotionConfig } from "motion/react";

import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";

type Point = Record<string, unknown>;

/**
 * The Bklit bar chart used on the earnings page. It lives in its own module so
 * the page can load visx and motion lazily, after the figures and tables.
 */
export default function EarningsBarChart({
  data,
  dataKey,
  color,
  formatValue,
}: {
  data: Point[];
  dataKey: string;
  color: string;
  formatValue: (point: Point) => string;
}) {
  return (
    // Honour the visitor's reduced-motion setting for the bar entrance.
    <MotionConfig reducedMotion="user">
      <BarChart data={data} xDataKey="month" aspectRatio="2 / 1">
        <Grid horizontal />
        <Bar dataKey={dataKey} fill={color} lineCap={4} />
        <BarXAxis />
        <ChartTooltip
          rows={(point) => [
            {
              color,
              label: String(point.label),
              value: formatValue(point),
            },
          ]}
        />
      </BarChart>
    </MotionConfig>
  );
}
