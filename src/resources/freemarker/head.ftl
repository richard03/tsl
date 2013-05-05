<#include "page.ftl" />

<#macro head>
	<#compress>

		<#if !isContextValid('page')>
			<@debugError "Head represents page head, it must be placed inside the page." />
		</#if>
		<#local pageContext = getContext("page") />

		<#local headContext = createContext("head", {}) />

		<head>
			<title>${pageContext["title"]}</title>
			<#nested>

			<#list pageStyles as style>
				<#if style.ieCond?is_boolean && style.ieCond == false>
					<#if hasText(style.comment)>
						<!-- ${style.comment} -->
					</#if>
					<#if hasText(style.url)>
						<link type="text/css" href="${style.url}" rel="stylesheet" />
					</#if>
				</#if>
			</#list>

			<#list pageStyles as style>
				<#if style.ieCond?is_string>
					<!--[if ${style.ieCond}]>
				</#if>
				<#if ! (style.ieCond?is_boolean && style.ieCond == false) >
					<link type = "text/css" href = "${style.url}" rel = "stylesheet" />
				</#if>
				<#if style.ieCond?is_string>
					<![endif]-->
				</#if>
			</#list>

			<#local pageContext = updateContext("page", { "headRendered": true}) />
		</head>
	</#compress>
</#macro>