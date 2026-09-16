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

async function blockDemoUserWrites(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const authContext = (req as AuthenticatedMedusaRequest).auth_context
  const actorId = authContext?.actor_id

  if (!actorId || authContext?.actor_type !== "user") {
    return next()
  }

  const userModule = req.scope.resolve<IUserModuleService>(Modules.USER)
  const user = await userModule.retrieveUser(actorId).catch(() => null)

  if (user?.email?.toLowerCase() !== DEMO_USER_EMAIL) {
    return next()
  }

  return next(
    new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "The demo user is read-only and cannot create, update, or delete data."
    )
  )
}

export default defineMiddlewares({
  routes: [
    {
      matcher: /^\/admin(\/.*)?$/,
      method: ["POST", "PUT", "PATCH", "DELETE"],
      middlewares: [blockDemoUserWrites],
    },
  ],
})
