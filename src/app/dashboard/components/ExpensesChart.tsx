"use client";

import React from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  TooltipItem,
} from "chart.js";

// Initialize Chart.js
ChartJS.register(ArcElement, Tooltip, Legend);

interface Transaction {
  type: string;
  amount: number;
  category: string | null; // Allow category to be null
}

const ExpensesChart = ({ data }: { data: { date: string; transactions?: Transaction[] }[] }) => {
  const allExpenseTransactions = data
    .flatMap(day => day.transactions || [])
    .filter(tx => tx?.type.toLowerCase() === "expense")
    .map(tx => ({
      category: tx.category || 'Uncategorized',
      amount: Math.abs(tx.amount),
    }));

  const expensesByCategory = allExpenseTransactions.reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
    return acc;
  }, {} as Record<string, number>);

  const sortedData = Object.entries(expensesByCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const processedData = sortedData.slice(0, 5);
  if (sortedData.length > 5) {
    const othersAmount = sortedData.slice(5).reduce((sum, item) => sum + item.amount, 0);
    if (othersAmount > 0) {
      processedData.push({ category: "Others", amount: othersAmount });
    }
  }

  const chartData = {
    labels: processedData.map(item => item.category),
    datasets: [
      {
        label: "Expenses",
        data: processedData.map(item => item.amount),
        backgroundColor: [
          "#3B82F6",
          "#10B981",
          "#F59E0B",
          "#8B5CF6",
          "#EC4899",
          "#6366F1",
        ],
        borderColor: "rgba(255, 255, 255, 0.8)",
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          padding: 20,
          font: { size: 12 },
          boxWidth: 12,
        },
      },
      tooltip: {
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: function (context: TooltipItem<"doughnut">) {
            const label = context.label || "";
            const value = context.raw as number;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
            return `${label}: Rp ${value.toLocaleString()} (${percentage}%)`;
          },
        },
      },
    },
    cutout: "65%",
    layout: {
      padding: { top: 10, bottom: 20, left: 10, right: 10 },
    },
    elements: {
      arc: {
        borderWidth: 2,
      },
    },
  };

  return (
    <div className="w-full h-64 md:h-80 relative flex flex-col">
      <div className="flex-1 relative">
        <Doughnut data={chartData} options={options} />
      </div>
      <div className="mt-4 text-center text-sm font-medium text-gray-600">
        Top expense categories breakdown
      </div>
    </div>
  );
};

export default ExpensesChart;
