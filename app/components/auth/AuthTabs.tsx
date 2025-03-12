import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import SignIn from "./sign-in"
import SignUp from "./sign-up"

import React from 'react'

const AuthTabs = () => {
  return (
	<>
		<Tabs defaultValue="sign-in" className="w-[400px]">
			<TabsList  className="grid w-full grid-cols-2">
				<TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="sign-in">Sign in</TabsTrigger>
				<TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="sign-up">Sign up</TabsTrigger>
			</TabsList>
			<TabsContent value="sign-in"><SignIn /></TabsContent>
			<TabsContent value="sign-up"><SignUp /></TabsContent>
		</Tabs>
	</>
  )
}

export default AuthTabs