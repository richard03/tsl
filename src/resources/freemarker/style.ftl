<#include "tslCore.ftl"/>
<#include "page.ftl"/>

<#--
	Any tsl.style tag appears at the head of the HTML page
	ieCond allows you to specify target version of Internet Explorer - other browsers ignore such definition
-->

<#macro style url = "" id = "" comment = "" ieCond = false>
	<#compress>
		<#if hasText(url)>
			<#local url>${url}</#local>
		<#else>
			<#local url><#compress><#nested /></#compress></#local>
		</#if>
		<#global pageStyles = pageStyles + [{"id": id, "url": url, "comment": comment, "ieCond": ieCond}] />
	</#compress>
</#macro>

