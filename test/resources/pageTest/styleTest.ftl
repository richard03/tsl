<#import '/src/resources/freemarker/tsl.ftl' as tsl />


<@tsl.page title = "My Styled Page">
	<@tsl.head>
		<@tsl.style url = "http://www.domain.com:123/css/testStyle.css?v=4&amp;lang=cz" />

		<@tsl.style url = "ie6Style.css" ieCond = "IE6" />
		<@tsl.style url = "ie7Style.css" ieCond = "IE7" />
	</@tsl.head>
	<@tsl.body></@tsl.body>
</@tsl.page>