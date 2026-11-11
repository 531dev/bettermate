import { machine } from '../services/ApiService.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart } from 'chart.js';
import { ChartComponent } from './Chart.jsx';
import { niceAxis, phaseMarkerColors } from '../utils/chartTheme.js';

// Global state to track phase transitions during brewing
let phaseTransitions = [];
let lastKnownPhase = null;
let brewStartTime = null;
let lastProcessState = null;
let initialPhaseName = null; // Store the first phase name

// Function to clear phase transitions (can be called from outside)
export const clearPhaseTransitions = () => {
  phaseTransitions = [];
  lastKnownPhase = null;
  brewStartTime = null;
  lastProcessState = null;
  initialPhaseName = null;
};

function getChartData(data) {
  // Stabilize the end time by rounding to the nearest second to prevent jiggling
  let end = new Date();
  end.setMilliseconds(0); // Round to nearest second for stability

  // Track phase transitions for brew process
  const currentProcess = machine.value.status.process;
  const isBrewActive =
    currentProcess &&
    currentProcess.s &&
    (currentProcess.s === 'brew' || currentProcess.s === 'infusion') &&
    currentProcess.a;

  // Determine time window based on brewing state
  let timeWindowMs;
  let timeUnit = 'second';
  let maxTicksLimit = 5;

  if (isBrewActive) {
    // During brewing: start with 30s window, grow to 45s and 60s for longer shots
    const brewElapsedMs = currentProcess.e || 0;
    const brewElapsedSeconds = brewElapsedMs / 1000;

    if (brewElapsedSeconds < 30) {
      // First 30 seconds: show 30s window
      timeWindowMs = 30000;
    } else if (brewElapsedSeconds < 45) {
      // 30-45 seconds: show 45s window
      timeWindowMs = 45000;
    } else {
      // After 45 seconds: show 60s window
      timeWindowMs = 60000;
    }

    maxTicksLimit = 8; // More ticks for better resolution
  } else if (phaseTransitions.length > 0) {
    // Recently finished brewing: show a bit more context
    timeWindowMs = 60000; // 1 minute
    maxTicksLimit = 6;
  } else {
    // Normal mode: show 1 minute
    timeWindowMs = 60000;
    maxTicksLimit = 5;
  }

  let start = new Date(end.getTime() - timeWindowMs);
  // Stabilize start time by rounding to nearest second for consistency
  start.setMilliseconds(0);

  // Filter data to the current time window for auto-scaling
  const filteredData = data.filter(item => item.timestamp >= start && item.timestamp <= end);

  // Calculate auto-scale ranges from visible data
  let tempValues = filteredData.map(i => i.currentTemperature);
  tempValues = tempValues.concat(filteredData.map(i => i.targetTemperature));

  let pressureFlowValues = filteredData.map(i => i.currentPressure);
  pressureFlowValues = pressureFlowValues.concat(filteredData.map(i => i.targetPressure));
  pressureFlowValues = pressureFlowValues.concat(filteredData.map(i => i.currentFlow));

  // Calculate ranges with some padding and round to integers for clean scales
  const tempAxis =
    tempValues.length > 0
      ? niceAxis(Math.max(0, Math.min(...tempValues) - 5), Math.max(...tempValues) + 5)
      : niceAxis(0, 160);
  const pressureFlowAxis =
    pressureFlowValues.length > 0
      ? niceAxis(0, Math.max(...pressureFlowValues) + 2)
      : niceAxis(0, 16);

  // Create a state key to detect when a new brew starts
  const processState = currentProcess
    ? `${currentProcess.s}_${currentProcess.a}_${currentProcess.e || 0}`
    : null;

  // Detect brew start/restart - check if we transitioned to active or if process restarted
  if (isBrewActive && (!brewStartTime || processState !== lastProcessState)) {
    // If elapsed time is very small (< 2 seconds), this is likely a new brew
    if (!currentProcess.e || currentProcess.e < 2000) {
      brewStartTime = new Date();
      phaseTransitions = [];
      lastKnownPhase = null;
      initialPhaseName = currentProcess.l; // Capture the initial phase name
    }
  }

  // Detect brew end - process stopped being active
  if (!isBrewActive && brewStartTime) {
    // Don't immediately clear - let the user see the phase markers for a while
    // They will be cleared when a new brew starts
  }

  // Track phase changes during brewing
  if (isBrewActive && currentProcess.l && brewStartTime) {
    const currentPhase = currentProcess.l;
    const currentPhaseType = currentProcess.s;

    // Only add transition if phase name actually changed and we're not on the first phase
    if (lastKnownPhase !== null && lastKnownPhase !== currentPhase) {
      // Check if we already have this transition (avoid duplicates)
      const existingTransition = phaseTransitions.find(t => t.phaseName === currentPhase);
      if (!existingTransition) {
        phaseTransitions.push({
          timestamp: new Date(),
          phaseName: currentPhase,
          phaseType: currentPhaseType,
        });
      }
    }
    lastKnownPhase = currentPhase;
  }

  lastProcessState = processState;

  // Create phase annotations for Chart.js
  const phaseAnnotations = {};
  const isSmall = window.innerWidth < 640;
  const marker = phaseMarkerColors();
  // Add phase transition lines
  phaseTransitions.forEach((transition, index) => {
    const transitionTime = transition.timestamp.getTime();
    const chartStart = start.getTime();
    const chartEnd = end.getTime();

    // Only show transitions within chart timeframe
    if (transitionTime >= chartStart && transitionTime <= chartEnd) {
      phaseAnnotations[`phase_line_${index}`] = {
        type: 'line',
        xMin: transition.timestamp.toISOString(),
        xMax: transition.timestamp.toISOString(),
        borderColor: marker.line,
        borderWidth: 1, // Thinner line
        label: {
          display: true,
          content: transition.phaseName,
          rotation: -90,
          position: 'end', // anchor at top of line
          xAdjust: -10, // tweak first label inward to compensate for y-axis padding
          yAdjust: 0,
          padding: { x: 6, y: 0 },
          color: marker.text,
          backgroundColor: marker.background,
          textAlign: 'start',
          font: {
            size: isSmall ? 9 : 11,
            weight: 500,
          },
          clip: false,
        },
      };
    }
  });

  // Add brew start line if within timeframe
  if (brewStartTime) {
    const brewStartMs = brewStartTime.getTime();
    const chartStart = start.getTime();
    const chartEnd = end.getTime();

    if (brewStartMs >= chartStart && brewStartMs <= chartEnd) {
      phaseAnnotations['brew_start'] = {
        type: 'line',
        xMin: brewStartTime.toISOString(),
        xMax: brewStartTime.toISOString(),
        borderColor: marker.line,
        borderWidth: 1,
        label: {
          display: true,
          content: initialPhaseName || 'Start',
          rotation: -90,
          position: 'end', // anchor at top of line
          xAdjust: -10, // tweak first label inward to compensate for y-axis padding
          yAdjust: 0,
          padding: { x: 6, y: 0 },
          color: marker.text,
          backgroundColor: marker.background,
          textAlign: 'start',
          font: {
            size: isSmall ? 9 : 11,
            weight: 500,
          },
          clip: false,
        },
      };
    }
  }

  const latestData = data[data.length - 1];
  const showWeights = latestData && latestData.volumetricAvailable && latestData.brewTarget;
  const datasets = [
    {
      label: 'Current Temperature',
      borderColor: '#F0561D',
      pointStyle: false,
      data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.currentTemperature })),
    },
    {
      label: 'Target Temperature',
      borderColor: '#731F00',
      borderDash: [6, 6],
      pointStyle: false,
      data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.targetTemperature })),
    },
    {
      label: 'Current Pressure',
      borderColor: '#0066CC',
      pointStyle: false,
      yAxisID: 'y1',
      data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.currentPressure })),
    },
    {
      label: 'Target Pressure',
      borderColor: '#003366',
      borderDash: [6, 6],
      pointStyle: false,
      yAxisID: 'y1',
      data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.targetPressure })),
    },
    {
      label: 'Current Flow',
      borderColor: '#63993D',
      pointStyle: false,
      yAxisID: 'y1',
      data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.currentFlow })),
    },
  ];
  if (showWeights) {
    datasets.push({
      label: 'Current Weight',
      borderColor: '#8B5CF6',
      pointStyle: false,
      yAxisID: 'y2',
      data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.currentWeight || 0 })),
    });
    datasets.push({
      label: 'Target Weight',
      borderColor: '#4C1D95',
      borderDash: [6, 6],
      pointStyle: false,
      yAxisID: 'y2',
      data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.activeTargetWeight || 0 })),
    });
  }

  return {
    type: 'line',
    data: {
      datasets: datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          display: true,
          labels: {
            usePointStyle: true,
            pointStyle: 'line',
            pointStyleWidth: 20,
            padding: 8,
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            generateLabels: function (chart) {
              const original = Chart.defaults.plugins.legend.labels.generateLabels;
              // Targets are the dashed line in the same color, so the legend names each series once.
              return original
                .call(this, chart)
                .filter(label => !label.text.startsWith('Target'))
                .map(label => ({
                  ...label,
                  text: label.text.replace('Current ', ''),
                  lineWidth: 3,
                }));
            },
          },
        },
        annotation: {
          annotations: phaseAnnotations,
        },
      },
      animation: false,
      scales: {
        y: {
          type: 'linear',
          min: tempAxis.min,
          max: tempAxis.max,
          ticks: {
            stepSize: tempAxis.step,
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            callback: value => {
              return `${Math.round(value)}°`; // Round displayed values to integers
            },
          },
        },
        y1: {
          type: 'linear',
          min: pressureFlowAxis.min,
          max: pressureFlowAxis.max,
          position: 'right',
          title: { display: true, text: 'bar, ml/s' },
          // One set of grid lines: the two axes' ticks rarely line up.
          grid: { drawOnChartArea: false },
          ticks: {
            stepSize: pressureFlowAxis.step,
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            callback: value => {
              return Math.round(value * 10) / 10; // Units are shown once beside the axis.
            },
          },
        },
        ...(showWeights && {
          y2: {
            type: 'linear',
            display: false,
            min: 0,
            max: 100,
          },
        }),
        x: {
          type: 'time',
          min: start,
          max: end,
          grid: { display: false },
          time: {
            unit: timeUnit,
            stepSize: 1, // Force consistent step size
            displayFormats: {
              second: isBrewActive ? 'mm:ss' : 'HH:mm:ss',
            },
          },
          ticks: {
            source: 'auto',
            autoSkip: true,
            autoSkipPadding: 0,
            callback: (value, index, ticks) => {
              if (isBrewActive) {
                // For brewing: show relative time from chart end in a clean format
                const chartEnd = end.getTime();
                const diffSeconds = Math.ceil((chartEnd - value) / 1000);
                if (diffSeconds < 60) {
                  return `${diffSeconds}s`;
                } else {
                  const minutes = Math.floor(diffSeconds / 60);
                  const seconds = diffSeconds % 60;
                  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
              } else {
                // For normal view: show time ago from chart end
                const chartEnd = end.getTime();
                const diff = Math.ceil((chartEnd - value) / 1000);
                return `-${diff}s`;
              }
            },
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            maxTicksLimit: maxTicksLimit,
          },
        },
      },
    },
  };
}

export function OverviewChart() {
  const chartData = getChartData(machine.value.history);

  return (
    <ChartComponent
      className='h-full min-h-0 w-full flex-1'
      chartClassName='h-full w-full'
      data={chartData}
    />
  );
}
