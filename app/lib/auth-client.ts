import { createAuthClient } from "better-auth/react"
import { passkeyClient, adminClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    baseURL: process.env.BETTER_AUTH_URL, // the base url of your auth server
	plugins: [
		passkeyClient(),
		adminClient(),
	],
})

export const {
    signIn,
    signOut,
    signUp,
    useSession
} = authClient;