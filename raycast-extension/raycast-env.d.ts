/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Supabase URL - URL de tu proyecto Supabase (ej: https://xxx.supabase.co) */
  "supabaseUrl": string,
  /** Supabase Anon Key - La anon/public key de tu proyecto Supabase */
  "supabaseAnonKey": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `quick-add` command */
  export type QuickAdd = ExtensionPreferences & {}
  /** Preferences accessible in the `quick-add-income` command */
  export type QuickAddIncome = ExtensionPreferences & {}
  /** Preferences accessible in the `login` command */
  export type Login = ExtensionPreferences & {}
  /** Preferences accessible in the `recent` command */
  export type Recent = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `quick-add` command */
  export type QuickAdd = {
  /** 45000 sushi */
  "text": string
}
  /** Arguments passed to the `quick-add-income` command */
  export type QuickAddIncome = {
  /** 1500000 sueldo */
  "text": string
}
  /** Arguments passed to the `login` command */
  export type Login = {}
  /** Arguments passed to the `recent` command */
  export type Recent = {}
}

