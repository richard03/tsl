<#-- Debug Support -->

<#global showDebugErrors = true />
<#global showDebugWarnings = true />

<#macro debugError message="">
	<#if showDebugErrors>
		<#compress>
			<pre class="tsl-debugError">
				<#if hasText(message)>
					ERROR: ${message}
				</#if>
				<#nested />
			</pre>
		</#compress>
	</#if>
</#macro>

<#macro debugWarning message="">
	<#if showDebugWarnings>
		<#compress>
			<pre class="tsl-debugWarning">
				<#if hasText(message)>
					WARNING: ${message}
				</#if>
				<#nested />
			</pre>
		</#compress>
	</#if>
</#macro>





<#--  Common helper functions  -->

<#function if condition ifTrue ifFalse>
	<#if condition>
		<#return ifTrue />
	<#else>
		<#return ifFalse />
	</#if>
</#function>


<#function hasText text = "">
	<#return text?? && text?is_string && text?trim?length gt 0 />
</#function>


<#function toBoolean value>
	<#if value?is_boolean>
		<#return value />
	</#if>
	<#if value?is_string>
		<#return value == "true" />
	</#if>
</#function>


<#function attr name values...>
	<#compress>
		<#local result = "">
		<#if values?is_enumerable>
			<#list values as value>
				<#local result = result + " " + value!>
			</#list>
		</#if>
		<#if result?trim?length gt 0>
			<#return name + ' = "' + result?trim?xml + '"'>
		</#if>
		<#return ''>
	</#compress>
</#function>


<#function attrRaw name value>
	<#compress>
		<#if value?trim?length gt 0>
			<#return name + ' = "' + value?trim + '"'>
		</#if>
		<#return ''>
	</#compress>
</#function>




<#-- Support for generating unique IDs -->

<#global uniqueSequence = 0 />
<#global createdIds = {} />

<#function createId type names...>
	<#local idBase = type />
	<#list names as name>
		<#if hasText(name)>
			<#local idBase = name />
			<#break />
		</#if>
	</#list>
	<#local idBase = idBase?replace(".", "_")?replace(":", "_") />
	<#if createdIds[idBase]??>
		<#local idOrder = createdIds[idBase] + 1/>
		<#global createdIds = createdIds + {idBase: idOrder} />
		<#return idBase + "_GEN" + idOrder />
	<#else>
		<#global createdIds = createdIds + {idBase: 1} />
		<#return idBase />
	</#if>
</#function>



<#-- Support for global contexts -->

<#global _uiContext = {} />

<#function isContextValid name>
	<#return _uiContext[name]?? && _uiContext[name]?is_hash />
</#function>

<#function getContext name>
	<#if isContextValid(name)>
		<#return _uiContext[name] />
	</#if>
	<@debugError message = "Missing or invalid context: " + name />
	<#return {} />
</#function>

<#function createContext name value>
	<#if isContextValid(name)>
		<@debugError message = "Previous context was lost: " + name />
	</#if>
	<#global _uiContext = _uiContext + {name: value} />
	<#return getContext(name) />
</#function>

<#function updateContext name value>
	<#local context = _uiContext[name] />
	<#local context = context + value />
	<#global _uiContext = _uiContext + {name: context} />
	<#return context />
</#function>

<#function removeContext name>
	<#global _uiContext = _uiContext + {name: false} />
	<#return false />
</#function>

<#macro overrideContext name values>
	<#if isContextValid(name)>
		<#local originalContext = _uiContext[name] />
		<#local newContext = originalContext + values />
		<#global _uiContext = _uiContext + {name: newContext} />
		<#nested />
		<#global _uiContext = _uiContext + {name: originalContext} />
	<#else>
		<@debugError message = "Missing or invalid context: " + name />
	</#if>
</#macro>