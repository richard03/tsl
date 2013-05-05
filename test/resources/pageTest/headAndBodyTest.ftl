<#import '/src/resources/freemarker/tsl.ftl' as tsl />

<@tsl.page title = "fooBar Page">
	<@tsl.head>
		<meta name = "foo" content = "bar" />
	</@tsl.head>
	<@tsl.body>
		Test content
	</@tsl.body>
</@tsl.page>