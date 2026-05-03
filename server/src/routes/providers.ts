import { Hono } from "hono";
import { getProvidersState, patchProviderDefaults } from "../services/state";
import { getPiCapabilities } from "../services/pi-capabilities";
import { refreshPiModels, getPiCore } from "../services/pi-core";

export const providersRoutes = new Hono()
  .get("/", async (c) => {
    const [capabilities, selections] = await Promise.all([getPiCapabilities(), getProvidersState()]);
    return c.json({
      ok: capabilities.ok,
      error: capabilities.error,
      defaultProvider: selections.defaultProvider,
      defaultModel: selections.defaultModel,
      providers: capabilities.providers
    });
  })
  .post("/:id/auth", async (c) => {
    const providerId = c.req.param("id");
    const body = await c.req.json().catch(() => null) as { apiKey?: string } | null;
    if (!body?.apiKey) return c.json({ ok: false, message: "apiKey required" }, 400);

    const { authStorage, modelRegistry } = await getPiCore();
    authStorage.set(providerId, { type: "api_key", key: body.apiKey });
    modelRegistry.refresh();
    const caps = await getPiCapabilities(true);
    const provider = caps.providers.find((p) => p.id === providerId);
    return c.json({ ok: true, models: provider?.modelIds.length ?? 0 });
  })
  .delete("/:id/auth", async (c) => {
    const providerId = c.req.param("id");
    const { authStorage } = await getPiCore();
    if (!authStorage.has(providerId)) return c.json({ ok: false, message: "provider not configured" }, 404);
    authStorage.remove(providerId);
    await refreshPiModels();
    await getPiCapabilities(true);
    return c.json({ ok: true });
  })
  .patch("/defaults", async (c) => {
    const body = await c.req.json().catch(() => null) as { defaultProvider?: string; defaultModel?: string } | null;
    const [capabilities, state] = await Promise.all([getPiCapabilities(), getProvidersState()]);
    if (!capabilities.ok) return c.json({ ok: false, message: capabilities.error ?? "pi discovery failed" }, 503);
    const nextProvider = body?.defaultProvider ?? state.defaultProvider;
    const nextModel = body?.defaultModel ?? state.defaultModel;
    const provider = capabilities.providers.find((p) => p.id === nextProvider);
    if (!provider) return c.json({ ok: false, message: "provider not available in pi" }, 400);
    if (provider.modelIds.length > 0 && nextModel && !provider.modelIds.includes(nextModel)) {
      return c.json({ ok: false, message: "model not supported by provider" }, 400);
    }
    const next = await patchProviderDefaults({ defaultProvider: nextProvider, defaultModel: nextModel });
    return c.json(next);
  });
