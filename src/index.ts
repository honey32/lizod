// lightweight zod

type AccessPath = Array<(string | symbol | number)>;
type ValidatorContext = {
  errors: Array<AccessPath>;
};

export type Validator<Expect> = (
  input: any,
  ctx?: ValidatorContext,
  path?: (string | symbol | number)[],
) => input is Expect;
export type ValidatorObject<Expect extends {}> = (input: any) => input is {
  [K in keyof Expect]: Expect[K] extends Validator<infer CT> ? CT : never;
};
type ValidatorsToUnion<Vs> = Vs extends Array<Validator<infer T>> ? T
  : never;

export type Infer<T> = T extends ValidatorObject<any> ? {
    [K in keyof T]: Infer<T[K]>;
  }
  : T extends Validator<infer E> ? E
  : never;

// https://stackoverflow.com/questions/75405517/typescript-generic-function-where-parameters-compose-into-the-return-type
type TupleToIntersection<T extends any[]> = {
  [I in keyof T]: (x: T[I]) => void;
}[number] extends (x: infer R) => void ? R : never;

export const $const =
  <T extends number | string | boolean | undefined | void | symbol>(
    def: T,
  ): Validator<T> =>
  (input: any): input is T => {
    return input === def;
  };

// for compressor
const _typeof = (input: any): string => typeof input;

export const $undefined: Validator<undefined> = (
  input: any,
): input is undefined => {
  return input === undefined;
};

export const $null: Validator<null> = (input: any): input is null => {
  return input === null;
};

export const $void: Validator<void> = (input: any): input is void => {
  return input == null;
};

export const $any: Validator<void> = (input: any): input is any => {
  return true;
};

export const $opt =
  <T>(validator: Validator<T>): Validator<T | void> =>
  (input: any, ctx): input is T | void => {
    return input == null || validator(input, ctx);
  };

export const $nullable =
  <T>(validator: Validator<T>): Validator<NonNullable<T> | null> =>
  (input: any, ctx): input is NonNullable<T> | null => {
    return input === null || validator(input, ctx);
  };

export const $string: Validator<string> = (input: any): input is string => {
  return _typeof(input) === "string";
};

export const $regexp =
  (regexp: RegExp): Validator<string> => (input: any): input is string => {
    return _typeof(input) === "string" && regexp.test(input);
  };

export const $symbol: Validator<symbol> = (input: any): input is symbol => {
  return _typeof(input) === "symbol";
};

export const $number: Validator<number> = (input: any): input is number => {
  return _typeof(input) === "number";
};

export const $boolean: Validator<boolean> = (input: any): input is boolean => {
  return typeof input === "boolean";
};

export const $enum =
  <E extends Array<string>>(enums: E): Validator<E[number]> =>
  (input: any): input is E[number] => {
    return enums.includes(input);
  };

export const $intersection = <T extends any[]>(
  validators: [...{ [I in keyof T]: Validator<T[I]> }],
): Validator<TupleToIntersection<T>> => {
  return ((
    input: any,
    ctx: ValidatorContext = { errors: [] },
    path: (string | symbol | number)[] = [],
  ): input is TupleToIntersection<T> => {
    for (const validator of validators) {
      if (!validator(input, ctx, path)) return false;
    }
    return true;
  });
};

export const $union = <T, Vs extends Array<Validator<T>>>(validators: Vs) =>
(
  input: any,
  ctx?: ValidatorContext,
  path: (string | symbol | number)[] = [],
): input is ValidatorsToUnion<Vs> => {
  for (const validator of validators) {
    if (validator(input, ctx, path)) {
      return true;
    }
  }
  return false;
};

export const $object = <
  Map extends {
    [key: string]: Validator<any>;
  },
>(vmap: Map, exact: boolean = true) => {
  const fn = (
    input: any,
    ctx?: ValidatorContext,
    path: AccessPath = [],
  ): input is {
    [K in keyof Map]: Map[K] extends ValidatorObject<infer O> ? O
      : Map[K] extends Validator<infer I> ? I
      : never;
  } => {
    if (_typeof(input) !== "object" || input === null) {
      return false;
    }
    const unchecked = new Set(Object.keys(input));
    let failed = false;
    for (const [key, validator] of Object.entries(vmap)) {
      if (key === "__proto__") {
        continue;
      }
      const childPath = [...path, key] as AccessPath;
      if (!validator(input?.[key], ctx, childPath)) {
        failed = true;
        ctx?.errors.push(childPath);
      }
      unchecked.delete(key);
    }
    if (failed) return false;
    if (exact) {
      return unchecked.size === 0;
    } else {
      return true;
    }
  };
  return fn;
};

export const $array = <
  T extends Validator<any>,
>(child: T) => {
  const fn = (
    input: any,
    ctx?: ValidatorContext,
    path: AccessPath = [],
  ): input is Array<
    T extends Validator<infer O> ? O : never
  > => {
    if (!Array.isArray(input)) return false;
    let failed = false;
    for (let i = 0; i < input.length; i++) {
      const childPath = [...path, i];
      const v = input[i];
      if (!child(v, ctx, childPath)) {
        failed = true;
        ctx?.errors.push(childPath);
      }
    }
    if (failed) return false;
    return true;
  };
  return fn;
};

export const access = (obj: any, path: Array<string | number>) =>
  path.reduce((o, k) => o?.[k], obj);
