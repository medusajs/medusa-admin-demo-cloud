import type { IUserModuleService } from "@medusajs/framework/types"
import {
  authenticate,
  defineMiddlewares,
  type AuthenticatedMedusaRequest,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"

const DEMO_USER_EMAIL = "demo@medusajs.com"

const demoUserReadOnlyError = () =>
  new MedusaError(
    MedusaError.Types.NOT_ALLOWED,
    "The demo user is read-only and cannot create, update, or delete data."
  )

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

  return next(demoUserReadOnlyError())
}

// Password reset is unauthenticated, so the demo user is identified by the
// identifier in the request body rather than the auth context.
function blockDemoUserPasswordReset(
  req: MedusaRequest<{ identifier?: string }>,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const identifier = req.body?.identifier

  if (
    req.params.actor_type !== "user" ||
    typeof identifier !== "string" ||
    identifier.toLowerCase() !== DEMO_USER_EMAIL
  ) {
    return next()
  }

  return next(demoUserReadOnlyError())
}

// Routes under /auth have no global auth middleware, so populate the auth
// context ourselves (without rejecting anonymous requests) to make the demo
// user check independent of the order in which core middlewares run.
const blockDemoUserAuthWrites = [
  authenticate("*", ["session", "bearer"], {
    allowUnregistered: true,
    allowUnauthenticated: true,
    requireMfa: false,
  }),
  blockDemoUserWrites,
]

export default defineMiddlewares({
  routes: [
    {
      matcher: /^\/admin(\/.*)?$/,
      method: ["POST", "PUT", "PATCH", "DELETE"],
      middlewares: [blockDemoUserWrites],
    },
    // Enrolling, verifying, or disabling MFA factors and generating recovery
    // codes would lock other visitors out of the shared demo account.
    {
      matcher: "/auth/mfa/factors",
      method: ["POST"],
      middlewares: blockDemoUserAuthWrites,
    },
    {
      matcher: "/auth/mfa/factors/:id",
      method: ["DELETE"],
      middlewares: blockDemoUserAuthWrites,
    },
    {
      matcher: "/auth/mfa/factors/:id/verify",
      method: ["POST"],
      middlewares: blockDemoUserAuthWrites,
    },
    {
      matcher: "/auth/mfa/recovery-codes",
      method: ["POST"],
      middlewares: blockDemoUserAuthWrites,
    },
    {
      matcher: "/auth/verification/request",
      method: ["POST"],
      middlewares: blockDemoUserAuthWrites,
    },
    {
      matcher: "/auth/verification/confirm",
      method: ["POST"],
      middlewares: blockDemoUserAuthWrites,
    },
    {
      matcher: "/auth/:actor_type/:auth_provider/reset-password",
      method: ["POST"],
      middlewares: [blockDemoUserPasswordReset],
    },
  ],
})
