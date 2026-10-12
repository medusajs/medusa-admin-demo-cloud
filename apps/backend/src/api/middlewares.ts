import type { IUserModuleService } from "@medusajs/framework/types"
import {
  defineMiddlewares,
  type AuthenticatedMedusaRequest,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"

const DEMO_USER_EMAIL = "demo@medusajs.com"

async function isDemoUser(req: MedusaRequest) {
  const authContext = (req as AuthenticatedMedusaRequest).auth_context
  const actorId = authContext?.actor_id

  if (!actorId || authContext?.actor_type !== "user") {
    return false
  }

  const userModule = req.scope.resolve<IUserModuleService>(Modules.USER)
  const user = await userModule.retrieveUser(actorId).catch(() => null)

  return user?.email?.toLowerCase() === DEMO_USER_EMAIL
}

async function blockDemoUserWrites(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (!(await isDemoUser(req))) {
    return next()
  }

  return next(
    new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "The demo user is read-only and cannot create, update, or delete data."
    )
  )
}

// Invites and notifications carry secrets (invite tokens, and any token a
// notification template was sent with), so the demo user gets empty lists.
function hideFromDemoUser(key: string) {
  return async (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    if (!(await isDemoUser(req))) {
      return next()
    }

    if (req.params.id) {
      return next(
        new MedusaError(MedusaError.Types.NOT_FOUND, `${key} not found`)
      )
    }

    res.json({ [key]: [], count: 0, offset: 0, limit: 0 })
  }
}

export default defineMiddlewares({
  routes: [
    {
      matcher: /^\/admin(\/.*)?$/,
      method: ["POST", "PUT", "PATCH", "DELETE"],
      middlewares: [blockDemoUserWrites],
    },
    {
      // MFA enrollment lives under /auth, not /admin. Without this, anyone
      // logged in as the demo user can enroll a factor and lock everyone out.
      matcher: /^\/auth\/mfa\/(factors|recovery-codes)(\/.*)?$/,
      method: ["POST", "DELETE"],
      middlewares: [blockDemoUserWrites],
    },
    {
      matcher: "/admin/invites",
      method: ["GET"],
      middlewares: [hideFromDemoUser("invites")],
    },
    {
      matcher: "/admin/invites/:id",
      method: ["GET"],
      middlewares: [hideFromDemoUser("invites")],
    },
    {
      matcher: "/admin/notifications",
      method: ["GET"],
      middlewares: [hideFromDemoUser("notifications")],
    },
    {
      matcher: "/admin/notifications/:id",
      method: ["GET"],
      middlewares: [hideFromDemoUser("notifications")],
    },
  ],
})
