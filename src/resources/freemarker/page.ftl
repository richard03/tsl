<#include "tslCore.ftl"/>

<#global pageStyles = [] />
<#global pageScripts = [] />

<#macro page
		title

		id = ""
		class = ""

		action = ""
		multipart = false>
	<#compress>
		<#local pageContext = createContext("page", {
				"title": title,
				"action": action,
				"isMultipart": multipart,

				"id": id,
				"class": class,

				"headRendered": false,
				"bodyRendered": false
			}) />

		<!DOCTYPE html>
		<html>
			<#nested />
		</html>
	</#compress>
</#macro>