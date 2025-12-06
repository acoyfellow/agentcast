# AgentCast

AgentCast extends the [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/) with browser automation and live screencasting. Get full visibility into what your agents are doing—watch them navigate, interact, and extract data from web applications in real-time.

## What You Get

- **Watch agents work**: Stream live video of your browser agent's actions via CDP—see exactly what it's doing as it happens
- **Control via natural language**: Talk to your agent with plain English instructions (powered by [Stagehand](https://github.com/browserbase/stagehand))
- **Built-in browser environment**: No extra setup—browser automation comes out of the box with all Agents SDK features
- **Live debugging**: Debug agents by watching them, not guessing from logs
- **Session tracking**: Monitor what your agents are doing via activity timestamps and session status

## Installation

```bash
npm install agentcast agents @cloudflare/containers zod
```

**Requirements:**
- Cloudflare Workers with Containers binding
- Cloudflare Agents SDK (peer dependency)
- Runs exclusively on Cloudflare infrastructure

## Quick Start

```typescript
import { BrowserAgent } from 'agentcast';
import { z } from 'zod';

export class WebAgent extends BrowserAgent {
  protected getContainer() {
    return this.env.CONTAINER;
  }
  
  // Step 1: Initialize and get the CDP URL for watching
  async start() {
    await this.initialize({
      sessionId: this.name,
      viewport: { width: 1280, height: 720 }
    });
    return {
      cdpUrl: this.cdpUrl,   // WebSocket URL for CDP connection
      viewUrl: this.viewUrl  // Browser URL to watch the session
    };
  }
  
  // Step 2: Perform actions while someone watches
  async run() {
    await this.act('goto example.com');
    await this.act('click the login button');
    await this.act('fill in the email field with test@example.com');
    await this.act('scroll down and click the submit button');
    
    // Extract structured data
    const data = await this.extract(z.object({
      title: z.string(),
      price: z.number(),
    }));
    
    return { data };
  }
}
```

## How It Works

1. **Stagehand** handles the natural language → browser actions translation
2. **CDP screencast** streams frames to connected viewers  
3. **Cloudflare Containers** run the browser instances
4. **Workers** orchestrate sessions and expose the API

The `act()` method uses Stagehand's agent, so you can give complex, conversational instructions and it figures out how to execute them.

## API Reference

### BrowserAgent

Abstract base class that extends `Agent` with browser capabilities.

**Methods**:
- `initialize(options): Promise<void>` - Initialize browser session (called automatically by other methods, but can be called manually)
- `goto(url: string): Promise<void>` - Navigate to URL
- `act(instruction: string): Promise<void>` - Execute natural language instruction
- `extract<T>(schema: z.ZodSchema<T>): Promise<T>` - Extract structured data from the page
- `resize(viewport: { width: number; height: number }): Promise<void>` - Resize browser
- `reload(): Promise<void>` - Reload current page
- `stop(): Promise<void>` - Stop browser session
- `confirm(prompt: string, options?: { timeout?: number }): Promise<boolean>` - Pause execution and wait for confirmation (viewer integration coming soon)

**Properties**:
- `viewUrl: string` - URL to view the browser session
- `cdpUrl: string` - WebSocket URL for CDP connection
- `status: SessionStatus` - Current session status

## Viewer Features & Control

The embedded viewer (`viewUrl`) lets you watch and control the browser in real-time:

### Live Control
- **Mouse**: Click, scroll, drag the browser from the viewer
- **Keyboard**: Type directly into the browser via the viewer
- **Touch**: Full touch event support

### Browser Control
The viewer iframe exposes a `window.agentcastViewer` API for programmatic control:

```typescript
// Insert bulk text (faster than keyboard events)
window.agentcastViewer.insertText('Large amount of text...');

// Send CDP commands directly
window.agentcastViewer.sendCdpCommand('Page.navigate', { url: 'https://example.com' });

// Handle file uploads
window.agentcastViewer.uploadFiles(['/path/to/file']);

// Control zoom level
window.agentcastViewer.setZoom(1.5);

// Toggle metrics overlay (FPS, ping, frame drops)
window.agentcastViewer.toggleMetrics();

// Copy to clipboard
await window.agentcastViewer.copyToClipboard('text to copy');
```

### Browser Monitoring
The viewer automatically captures and forwards:
- **Console logs**: Browser console output appears in viewer logs
- **Browser logs**: Console API and Log domain events
- **Frame metrics**: Real-time FPS counter
- **Connection metrics**: Ping/latency measurements
- **Frame drops**: Connection quality indicator

### Bidirectional CDP Communication
Send arbitrary Chrome DevTools Protocol commands from parent window:

```typescript
// From parent window (demo or orchestration layer)
iframe.contentWindow.postMessage({
  type: 'cdp_command',
  method: 'Page.captureScreenshot',
  params: { format: 'png' }
}, '*');

// Listen for responses
window.addEventListener('message', (event) => {
  if (event.data.type === 'cdp_response') {
    console.log('Screenshot:', event.data.result);
  }
});
```

### File Upload Handling
When a file chooser dialog opens in the browser:

```typescript
// Intercept and handle file uploads
iframe.contentWindow.postMessage({
  type: 'file_upload',
  files: ['/local/path/to/file.pdf']
}, '*');
```

### Console Forwarding
Browser logs are automatically forwarded to parent:

```typescript
// Listen for browser console messages
window.addEventListener('message', (event) => {
  if (event.data.type === 'viewer-log') {
    console.log('Browser:', event.data.message, event.data.level);
  }
});
```

### Metrics Overlay
When first frame is received, a metrics overlay displays:
- **FPS**: Frames per second
- **Ping**: Round-trip latency to CDP endpoint
- **Drops**: Frame drop counter

Toggle visibility with `window.agentcastViewer.toggleMetrics()`

**Abstract Method**:
- `protected abstract getContainer(): DurableObjectNamespace` - Must be implemented to return container namespace

**Types**:
- `SessionState` - Internal session state type (exported for advanced use cases)

## Session Tracking

Each agent session tracks activity and status:

```typescript
export class WebAgent extends BrowserAgent {
  async run() {
    await this.act('navigate to example.com');
    await this.act('click the button');
    const data = await this.extract(z.object({ title: z.string() }));

    // Check current status and activity
    console.log(this.status);      // 'ready' | 'starting' | 'error' | 'stopped'
    console.log(this.viewUrl);     // URL to watch the session
    console.log(this.cdpUrl);      // CDP WebSocket endpoint
  }
}
```

**Properties**:
- `status` - Current session status (starting, ready, error, stopped)
- `viewUrl` - URL to watch the browser in real-time
- `cdpUrl` - WebSocket URL for Chrome DevTools Protocol connection

## Client-Safe Exports

For client applications (SvelteKit, React, etc.), import only constants and types:

```typescript
import { CLIENT_STATUS, SERVER_STATUS, type SessionStatus } from 'agentcast';
```

These are safe to use in any environment and don't require Workers runtime.

## Requirements

- Cloudflare Workers with Containers binding
- Cloudflare Agents SDK (peer dependency)
- Zod for schema validation

## License

MIT

