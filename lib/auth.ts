import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins/admin";
import { createPool } from "mysql2/promise";
 
export const auth = betterAuth({
    database: createPool({
			host: process.env.MYSQL_HOST,
			user: process.env.MYSQL_USER,
			password: process.env.MYSQL_PASSWORD,
			database: process.env.MYSQL_DATABASE,
    }),

		emailAndPassword: {  
      enabled: true,
			autoSignIn: false, //defaults to true
			async sendResetPassword(data, request) {
            // Send an email to the user with a link to reset their password
        },
    },

		plugins: [
			admin(),
    ],

		session: {
			expiresIn: 60 * 60 * 24 * 7, // 7 days
			updateAge: 60 * 60 * 24 // 1 day (every 1 day the session expiration is updated)
		}
})