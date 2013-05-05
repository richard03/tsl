<#include "tslCore.ftl"/>
<#include "page.ftl"/>

<#--
	Standard tsl.script tag appears at the end of the HTML page
	as a link to the JavaScript
-->

<#macro script url = "" id = "" inline = false>
	<#compress>
		<#if !isContextValid('page')>
			<@debugError "Script must be placed inside the page." />
		</#if>
		<#if inline>
			<#if isContextValid('head') || isContextValid('body')>
				<#if hasText(url)>
					<script ${attr("src", url)} ${attr("id", id)} type="text/javascript"></script>
				<#else>
					<script type="text/javascript" ${attr("id", id)}>
						<#nested />
					</script>
				</#if>
			<#else>
				<@debugError "Script must be placed inside the page head or page body." />
			</#if>
		<#else>
			<#if hasText(url)>
				<#global pageScripts = pageScripts + [{"id": id, "url": url }] />
			</#if>
		</#if>
	</#compress>
</#macro>

