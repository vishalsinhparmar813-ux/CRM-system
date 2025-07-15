import { useMemo } from "react";
import { colors } from "@/constant/data";
import Chart from "react-apexcharts";
const Calculation = ({ height = 335, sold = 0, unsold = 0 }) => {
  const series = [sold, unsold];

  const options = {
    labels: ["Sold", "Unsold"],
    dataLabels: {
      enabled: true,
    },

    colors: [ colors.success, "#A3A1FB"],
    legend: {
      position: "bottom",
      fontSize: "12px",
      fontFamily: "Inter",
      fontWeight: 400,
      labels: {
        colors: "#CBD5E1",
      },
      markers: {
        width: 6,
        height: 6,
        offsetY: -1,
        offsetX: -5,
        radius: 12,
      },
      itemMargin: {
        horizontal: 10,
        vertical: 0,
      },
    },

    responsive: [
      {
        breakpoint: 480,
        options: {
          legend: {
            position: "bottom",
          },
        },
      },
    ],
  };

  return (
    <Chart options={options} series={series} type="pie" height={height} />
  );
};

export default Calculation;
