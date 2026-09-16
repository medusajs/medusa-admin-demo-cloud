import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"
import { useSearchParams } from "react-router-dom"

const DEMO_EMAIL = "demo@medusajs.com"
const DEMO_PASSWORD = "28cGk_-bEvYiTuuZ-ct-vZfG"

const setNativeInputValue = (element: HTMLInputElement, value: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )

  descriptor?.set?.call(element, value)
  element.dispatchEvent(new Event("input", { bubbles: true }))
}

const fillDemoCredentials = () => {
  const emailInput = document.querySelector<HTMLInputElement>(
    'input[name="email"], input[autocomplete="email"]'
  )
  const passwordInput = document.querySelector<HTMLInputElement>(
    'input[name="password"], input[autocomplete="current-password"]'
  )

  if (!emailInput || !passwordInput) {
    return false
  }

  setNativeInputValue(emailInput, DEMO_EMAIL)
  setNativeInputValue(passwordInput, DEMO_PASSWORD)

  return true
}

const DemoLoginWidget = () => {
  const [searchParams] = useSearchParams()
  const isDemoUser = searchParams.get("demo-user") === "true"

  useEffect(() => {
    if (!isDemoUser) {
      return
    }

    if (fillDemoCredentials()) {
      return
    }

    const observer = new MutationObserver(() => {
      if (fillDemoCredentials()) {
        observer.disconnect()
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [isDemoUser])

  return null
}

export const config = defineWidgetConfig({
  zone: "login.before",
})

export default DemoLoginWidget
