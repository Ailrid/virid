/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid
 */

import "reflect-metadata";
import { createVirid, System, SingleMessage, EventMessage } from "@virid/core";

// Disable logging system to ensure benchmark purity
const app = createVirid({
  enableLog: false,
  manual: true,
});

// Define message types for benchmark
class BenchmarkMessage extends SingleMessage {}
class ChainRootMessage extends EventMessage {}
class ChainRippleMessage extends SingleMessage {}

// Global performance counter
let performanceCounter = 0;

// Define systems using static methods with @System decorator
class BenchmarkSystem {
  @System()
  static handlePure(message: BenchmarkMessage) {
    performanceCounter++; // Simulate minimal CPU consumption
  }

  @System()
  static handleRoot(message: ChainRootMessage) {
    performanceCounter++;
    // Send cascading message to trigger inner while loop execution
    ChainRippleMessage.send();
  }

  @System()
  static handleRipple(message: ChainRippleMessage) {
    performanceCounter++;
  }
}

// Register systems
app.register(BenchmarkSystem.handlePure);
app.register(BenchmarkSystem.handleRoot);
app.register(BenchmarkSystem.handleRipple);

// Main benchmark runner
function runBenchmark() {
  const ITERATIONS = 300000;

  console.log("[Virid Core] Warming up V8 engine...");
  // Warm up to allow JIT optimization for wrappedSystem and inner loop
  for (let i = 0; i < 2000; i++) {
    BenchmarkMessage.send();
    app.tick();
    ChainRootMessage.send();
    app.tick();
  }
  performanceCounter = 0; // Reset counter

  console.log("\nScenario 1: Pure High-Frequency Throughput");
  const startPure = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    BenchmarkMessage.send();
    app.tick();
  }
  const endPure = performance.now();
  reportMetrics(startPure, endPure, ITERATIONS);

  console.log("\nScenario 2: Cascading Message Ripple");
  const startChain = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    ChainRootMessage.send();
    app.tick();
  }
  const endChain = performance.now();
  reportMetrics(startChain, endChain, ITERATIONS);

  console.log(`\nVerification: Counter final value: ${performanceCounter}`);
}

// Metrics calculator
function reportMetrics(start: number, end: number, iterations: number) {
  const durationMs = end - start;
  const opsPerSec = Math.floor((iterations / durationMs) * 1000);
  const latencyUs = (durationMs / iterations) * 1000;

  console.log(`Duration: ${durationMs.toFixed(2)} ms`);
  console.log(`Throughput: ${opsPerSec.toLocaleString()} ops/sec`);
  console.log(`Latency: ${latencyUs.toFixed(4)} us`);
}

// Start benchmark
runBenchmark();
