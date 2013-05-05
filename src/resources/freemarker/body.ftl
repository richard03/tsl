<#include "page.ftl" />
<#include "head.ftl" />

<#macro body>
	<#compress>

		<#if !isContextValid('page')>
			<@debugError "The 'body' tag represents page body, it must be placed inside the page." />
		</#if>

		<#local pageContext = getContext("page") />

		<#if !pageContext['headRendered']>
			<@head />
		</#if>
		<body ${attr("id", pageContext["id"])} ${attr("class", pageContext["class"])}>
			<form
					action = "${pageContext['action']}"
					<#if pageContext['isMultipart']>
						enctype = "multipart/form-data"
					</#if>
					method = "post">
				<#nested />
			</form>
			<#list pageScripts as script>
				<#if hasText(script.url)>
					<script ${attr("src", script.url)} type = "text/javascript" ${attr("id", script.id)}></script>
				</#if>
			</#list>
		</body>
		<#local pageContext = updateContext("page", { "bodyRendered": true}) />
	</#compress>
</#macro>