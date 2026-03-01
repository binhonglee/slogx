---
title: TypeScript SDK
sidebar_position: 2
---

Source: [`sdk/ts/slogx.ts`](https://github.com/binhonglee/slogx/blob/main/sdk/ts/slogx.ts)

## Install

```bash
npm install @binhonglee/slogx
```

## API

```ts
interface SlogConfig {
  isDev: boolean;
  port?: number;
  serviceName?: string;
  ciMode?: boolean;
  logFilePath?: string;
  maxEntries?: number;
}

slogx.init(config: SlogConfig): Promise<void>;
slogx.close(): void;
slogx.debug(...args: any[]): void;
slogx.info(...args: any[]): void;
slogx.warn(...args: any[]): void;
slogx.error(...args: any[]): void;
```

## Example

```ts
import { slogx } from '@binhonglee/slogx';

await slogx.init({ isDev: true, serviceName: 'api', port: 8080 });
slogx.info('request completed', { status: 200 });
```
