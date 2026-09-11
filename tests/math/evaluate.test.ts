import { describe, it, expect } from 'vitest';
import { evaluateExpression } from '@/lib/math/evaluate';

describe('evaluateExpression', () => {
  it('handles basic arithmetic and precedence', () => {
    expect(evaluateExpression('2+3*4')).toBe(14);
    expect(evaluateExpression('(2+3)*4')).toBe(20);
    expect(evaluateExpression('10/4')).toBeCloseTo(2.5);
    expect(evaluateExpression('10%3')).toBe(1);
  });

  it('handles right-associative exponent', () => {
    expect(evaluateExpression('2^3^2')).toBe(512);
  });

  it('matches mathjs unary-minus semantics', () => {
    expect(evaluateExpression('-3^2')).toBe(-9);
    expect(evaluateExpression('(-3)^2')).toBe(9);
    expect(evaluateExpression('-2*3')).toBe(-6);
    expect(evaluateExpression('2*-3')).toBe(-6);
    expect(evaluateExpression('2^-3')).toBeCloseTo(0.125);
  });

  it('handles functions and constants', () => {
    expect(evaluateExpression('sqrt(16)')).toBe(4);
    expect(evaluateExpression('sin(0)+cos(0)')).toBeCloseTo(1);
    expect(evaluateExpression('2*pi')).toBeCloseTo(2 * Math.PI);
    expect(evaluateExpression('exp(0)+abs(0-5)')).toBe(6);
  });

  it('rejects unsafe / invalid input instead of executing it', () => {
    expect(() => evaluateExpression('')).toThrow();
    expect(() => evaluateExpression('process.exit(1)')).toThrow();
    expect(() => evaluateExpression('a+b')).toThrow();
    expect(() => evaluateExpression('2;3')).toThrow();
    expect(() => evaluateExpression('1/0')).toThrow(); // non-finite
    expect(() => evaluateExpression('(2+3')).toThrow();
    expect(() => evaluateExpression('x'.repeat(600))).toThrow();
  });
});
