import { parseType, qlFn } from "./index.ts"

export function concat(...args: string[]) {
  return qlFn.create(`string::concat(${args.map(s => `"${s}"`).join(",")})`)
}

export function contains(value: string, search: string) {
  return qlFn.create(`string::contains(${parseType(value)},"${search}")`)
}

export function endsWith(value: string, search: string) {
  return qlFn.create(`string::endsWith(${parseType(value)},"${search}")`)
}

export function join(value: string, ...others: string[]) {
  return qlFn.create(`string::join(${parseType(value)},${others.map(s => `"${s}"`).join(",")})`)
}

export function len(value: string) {
  return qlFn.create(`string::len(${parseType(value)})`)
}

export function lowercase(value: string) {
  return qlFn.create(`string::lowercase(${parseType(value)})`)
}

export function repeat(value: string, count: number) {
  return qlFn.create(`string::repeat(${parseType(value)},${count})`)
}

export function replace(value: string, search: string, replace: string) {
  return qlFn.create(`string::replace(${parseType(value)},"${search}","${replace}")`)
}

export function reverse(value: string) {
  return qlFn.create(`string::reverse(${parseType(value)})`)
}

export function slice(value: string, start: number, end: number) {
  return qlFn.create(`string::slice(${parseType(value)},${start},${end})`)
}

export function slug(value: string) {
  return qlFn.create(`string::slug(${parseType(value)})`)
}

export function split(value: string, separator = ",") {
  return qlFn.create(`string::split(${parseType(value)},"${separator}")`)
}

export function startsWith(value: string, search: string) {
  return qlFn.create(`string::startsWith(${parseType(value)},"${search}")`)
}

export function trim(value: string) {
  return qlFn.create(`string::trim(${parseType(value)})`)
}

export function uppercase(value: string | qlFn) {
  return qlFn.create(`string::uppercase(${parseType(value)})`)
}

export function words(value: string) {
  return qlFn.create(`string::words(${parseType(value)})`)
}

export function is_alphanum(value: string) {
  return qlFn.create(`string::is::alphanum(${parseType(value)})`)
}

export function is_alpha(value: string) {
  return qlFn.create(`string::is::alpha(${parseType(value)})`)
}

export function is_ascii(value: string) {
  return qlFn.create(`string::is::ascii(${parseType(value)})`)
}

export function is_format(value: string, format: string) {
  return qlFn.create(`string::is::format(${parseType(value)},"${format}")`)
}

export function is_domain(value: string) {
  return qlFn.create(`string::is::domain(${parseType(value)})`)
}

export function is_email(value: string) {
  return qlFn.create(`string::is::email(${parseType(value)})`)
}

export function is_hexadecimal(value: string) {
  return qlFn.create(`string::is::hexadecimal(${parseType(value)})`)
}

export function is_latitude(value: string) {
  return qlFn.create(`string::is::latitude(${parseType(value)})`)
}

export function is_longitude(value: string) {
  return qlFn.create(`string::is::longitude(${parseType(value)})`)
}

export function is_numeric(value: string) {
  return qlFn.create(`string::is::numeric(${parseType(value)})`)
}

export function is_semver(value: string) {
  return qlFn.create(`string::is::semver(${parseType(value)})`)
}

export function is_url(value: string) {
  return qlFn.create(`string::is::url(${parseType(value)})`)
}

export function is_uuid(value: string) {
  return qlFn.create(`string::is::uuid(${parseType(value)})`)
}

export const strings = {
  concat,
  contains,
  endsWith,
  join,
  len,
  lowercase,
  repeat,
  replace,
  reverse,
  slice,
  slug,
  split,
  startsWith,
  trim,
  uppercase,
  words,
  is_alphanum,
  is_alpha,
  is_ascii,
  is_format,
  is_domain,
  is_email,
  is_hexadecimal,
  is_latitude,
  is_longitude,
  is_numeric,
  is_semver,
  is_url,
  is_uuid
}