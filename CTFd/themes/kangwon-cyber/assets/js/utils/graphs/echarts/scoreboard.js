import { colorHash } from "@ctfdio/ctfd-js/ui";
import { mergeObjects } from "../../objects";
import { cumulativeSum } from "../../math";
import dayjs from "dayjs";

export function getOption(mode, places, optionMerge) {
  let option = {
    title: {
      left: "center",
      text: "Top 10 " + (mode === "teams" ? "Teams" : "Users"),
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
      bottom: 35,
      data: [],
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
        dataZoom: {
          yAxisIndex: "none",
        },
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
        type: "time",
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

  const teams = Object.keys(places);
  for (let i = 0; i < teams.length; i++) {
    const team_score = [];
    const times = [];
    for (let j = 0; j < places[teams[i]]["solves"].length; j++) {
      team_score.push(places[teams[i]]["solves"][j].value);
      const date = dayjs(places[teams[i]]["solves"][j].date);
      times.push(date.toDate());
    }

    const total_scores = cumulativeSum(team_score);
    let scores = times.map(function (e, i) {
      return [e, total_scores[i]];
    });

    option.legend.data.push(places[teams[i]]["name"]);

    const data = {
      name: places[teams[i]]["name"],
      type: "line",
      label: {
        color: "#ffffff",
        normal: {
          position: "top",
          color: "#ffffff",
        },
      },
      itemStyle: {
        normal: {
          color: colorHash(places[teams[i]]["name"] + places[teams[i]]["id"]),
        },
      },
      data: scores,
    };
    option.series.push(data);
  }

  if (optionMerge) {
    option = mergeObjects(option, optionMerge);
  }
  return option;
}
