/**
 * Lightweight safe math evaluator — replaces mathjs (~100KB+) for the
 * calculation widget, which only needs basic arithmetic evaluation.
 *
 * Security: no eval()/Function — strict whitelist tokenizer + shunting-yard.
 * Anything outside the grammar (identifiers other than known functions /
 * constants, semicolons, property access…) throws instead of executing.
 *
 * Supported: + - * / % ^ (right-assoc), parentheses, unary minus,
 * functions sqrt sin cos tan log ln exp abs floor ceil round,
 * constants pi e. Angles in radians (same convention as mathjs).
 */

const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  log: (x) => Math.log10(x),
  ln: Math.log,
  exp: Math.exp,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'op'; op: string }
  | { kind: 'fn'; name: string }
  | { kind: 'lp' }
  | { kind: 'rp' };

const PREC: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '%': 2,
  // Unary minus binds looser than ^ (so -3^2 = -(3^2) = -9, like mathjs)
  // but tighter than * (so -2*3 = (-2)*3 = -6).
  neg: 2.5,
  '^': 3,
};

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const isDigit = (c: string) => c >= '0' && c <= '9';
  const isAlpha = (c: string) =>
    (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
  let prev: Token | null = null;

  while (i < expr.length) {
    const c = expr[i];
    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }
    if (isDigit(c) || c === '.') {
      let j = i;
      while (j < expr.length && (isDigit(expr[j]) || expr[j] === '.')) j++;
      const value = Number(expr.slice(i, j));
      if (!Number.isFinite(value)) throw new Error(`Invalid number`);
      tokens.push({ kind: 'num', value });
      prev = tokens[tokens.length - 1];
      i = j;
      continue;
    }
    if (isAlpha(c)) {
      let j = i;
      while (j < expr.length && (isAlpha(expr[j]) || isDigit(expr[j]))) j++;
      const name = expr.slice(i, j).toLowerCase();
      if (name in FUNCTIONS) {
        tokens.push({ kind: 'fn', name });
      } else if (name in CONSTANTS) {
        tokens.push({ kind: 'num', value: CONSTANTS[name] });
      } else {
        throw new Error(`Unknown identifier "${name}"`);
      }
      prev = tokens[tokens.length - 1];
      i = j;
      continue;
    }
    if (c === '(') {
      tokens.push({ kind: 'lp' });
      prev = tokens[tokens.length - 1];
      i++;
      continue;
    }
    if (c === ')') {
      tokens.push({ kind: 'rp' });
      prev = tokens[tokens.length - 1];
      i++;
      continue;
    }
    if ('+-*/%^'.includes(c)) {
      // Unary minus (or unary plus, a no-op) at start / after op / after '('.
      const unary =
        (c === '-' || c === '+') &&
        (prev === null ||
          prev.kind === 'lp' ||
          (prev.kind === 'op' && prev.op !== ')'));
      if (unary) {
        if (c === '-') tokens.push({ kind: 'op', op: 'neg' });
        // unary plus: ignore
      } else {
        tokens.push({ kind: 'op', op: c });
      }
      prev = tokens[tokens.length - 1] ?? prev;
      if (unary && c === '+') {
        // keep prev as-is
      } else if (!(unary && c === '+')) {
        prev = tokens[tokens.length - 1];
      }
      i++;
      continue;
    }
    throw new Error(`Unexpected character "${c}"`);
  }
  return tokens;
}

function applyOp(op: string, a: number, b?: number): number {
  switch (op) {
    case '+':
      return a + (b as number);
    case '-':
      return a - (b as number);
    case '*':
      return a * (b as number);
    case '/':
      return a / (b as number);
    case '%':
      return a % (b as number);
    case '^':
      return Math.pow(a, b as number);
    case 'neg':
      return -a;
    default:
      throw new Error(`Unknown operator "${op}"`);
  }
}

/** Evaluate an arithmetic expression. Throws on invalid/unsafe input. */
export function evaluateExpression(expr: string): number {
  if (typeof expr !== 'string' || expr.length === 0 || expr.length > 500) {
    throw new Error('Invalid expression');
  }
  const tokens = tokenize(expr);
  const values: number[] = [];
  const ops: Array<{ op: string } | { fn: string } | { lp: true }> = [];

  const reduce = (minPrec: number) => {
    while (ops.length > 0) {
      const top = ops[ops.length - 1];
      if ('lp' in top) break;
      if ('fn' in top) {
        ops.pop();
        const a = values.pop();
        if (a === undefined) throw new Error('Missing argument');
        values.push(FUNCTIONS[top.fn](a));
        continue;
      }
      const p = PREC[top.op];
      // '^' is right-associative: don't reduce on equal precedence.
      if (p < minPrec || (p === minPrec && top.op === '^')) break;
      ops.pop();
      if (top.op === 'neg') {
        const a = values.pop();
        if (a === undefined) throw new Error('Missing operand');
        values.push(-a);
      } else {
        const b = values.pop();
        const a = values.pop();
        if (a === undefined || b === undefined)
          throw new Error('Missing operand');
        values.push(applyOp(top.op, a, b));
      }
    }
  };

  for (const t of tokens) {
    if (t.kind === 'num') values.push(t.value);
    else if (t.kind === 'fn') ops.push({ fn: t.name });
    else if (t.kind === 'lp') ops.push({ lp: true });
    else if (t.kind === 'rp') {
      reduce(0);
      const lp = ops.pop();
      if (!lp || !('lp' in lp)) throw new Error('Mismatched parenthesis');
    } else if (t.op === 'neg') {
      // Prefix unary: push without reducing — there is no left operand yet
      // (reducing here would pop an empty stack on inputs like "--3").
      ops.push({ op: t.op });
    } else {
      const p = PREC[t.op];
      reduce(p);
      // For right-assoc '^', reduce() already keeps equal precedence.
      ops.push({ op: t.op });
    }
  }
  reduce(0);
  if (values.length !== 1 || ops.length > 0)
    throw new Error('Invalid expression');
  const result = values[0];
  if (!Number.isFinite(result)) throw new Error('Non-finite result');
  return result;
}
