import { colorHash } from "@ctfdio/ctfd-js/ui";
import { cumulativeSum } from "../../math";
import { mergeObjects } from "../../objects";
import dayjs from "dayjs";

export function getOption(id, name, solves, awards, optionMerge) {
  let option = {
    title: {
      left: "center",
      text: "Score over Time",
      textStyle: {
        color: "#ffffff",
      },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
        label: {
          backgroundColor: "#1e293b",
          color: "#ffffff",
        },
      },
      backgroundColor: "rgba(30, 41, 59, 0.9)",
      borderColor: "#334155",
      textStyle: {
        color: "#ffffff",
      },
    },
    legend: {
      type: "scroll",
      orient: "horizontal",
      align: "left",
      bottom: 0,
      data: [name],
      textStyle: {
        color: "#ffffff",
      },
      pageIconColor: "#ffffff",
      pageTextStyle: {
        color: "#ffffff",
      },
    },
    toolbox: {
      feature: {
        saveAsImage: {},
      },
      iconStyle: {
        borderColor: "#ffffff",
      },
    },
    grid: {
      containLabel: true,
    },
    xAxis: [
      {
        type: "category",
        boundaryGap: false,
        data: [],
        axisLabel: {
          color: "#ffffff",
        },
        axisLine: {
          lineStyle: {
            color: "#ffffff",
          },
        },
      },
    ],
    yAxis: [
      {
        type: "value",
        axisLabel: {
          color: "#ffffff",
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: "#ffffff",
          },
        },
        splitLine: {
          lineStyle: {
            color: "rgba(255, 255, 255, 0.1)",
          },
        },
      },
    ],
    dataZoom: [
      {
        id: "dataZoomX",
        type: "slider",
        xAxisIndex: [0],
        filterMode: "filter",
        height: 20,
        top: 35,
        fillerColor: "rgba(233, 236, 241, 0.4)",
        textStyle: {
          color: "#ffffff",
        },
      },
    ],
    series: [],
  };

  const times = [];
  const scores = [];
  const total = solves.concat(awards);

  total.sort((a, b) => {
    return new Date(a.date) - new Date(b.date);
  });

  for (let i = 0; i < total.length; i++) {
    const date = dayjs(total[i].date);
    times.push(date.toDate());
    try {
      scores.push(total[i].challenge.value);
    } catch (e) {
      scores.push(total[i].value);
    }
  }

  times.forEach(time => {
    option.xAxis[0].data.push(time);
  });

  option.series.push({
    name: name,
    type: "line",
    label: {
      color: "#ffffff",
      normal: {
        show: true,
        position: "top",
        color: "#ffffff",
      },
    },
    areaStyle: {
      normal: {
        color: colorHash(name + id),
      },
    },
    itemStyle: {
      normal: {
        color: colorHash(name + id),
      },
    },
    data: cumulativeSum(scores),
  });

  if (optionMerge) {
    option = mergeObjects(option, optionMerge);
  }
  return option;
}
