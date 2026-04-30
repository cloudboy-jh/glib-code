import { Hono } from "hono";
import { getProvidersState, patchProviderDefaults } from "../services/state";
import { getOpencodeCapabilities } from "../services/opencode-capabilities";

export const providersRoutes = new Hono()
  .get("/", async (c) => {
    const [capabilities, selections] = await Promise.all([getOpencodeCapabilities(), getProvidersState()]);
    return c.json({
      ok: capabilities.ok,
      error: capabilities.error,
      defaultProvider: selections.defaultProvider,
      defaultModel: selections.defaultModel,
      providers: capabilities.providers
    });
  })
  .patch("/defaults", async (c) => {
    const body = await c.req.json().catch(() => null) as { defaultProvider?: string; defaultModel?: string } | null;
    const [capabilities, state] = await Promise.all([getOpencodeCapabilities(), getProvidersState()]);
    if (!capabilities.ok) return c.json({ ok: false, message: capabilities.error ?? "opencode discovery failed" }, 503);
    const nextProvider = body?.defaultProvider ?? state.defaultProvider;
    const nextModel = body?.defaultModel ?? state.defaultModel;
    const provider = capabilities.providers.find((p) => p.id === nextProvider);
    if (!provider) return c.json({ ok: false, message: "provider not available in opencode" }, 400);
    if (provider.modelIds.length > 0 && nextModel && !provider.modelIds.includes(nextModel)) {
      return c.json({ ok: false, message: "model not supported by provider" }, 400);
    }
    const next = await patchProviderDefaults({ defaultProvider: nextProvider, defaultModel: nextModel });
    return c.json(next);
  });
