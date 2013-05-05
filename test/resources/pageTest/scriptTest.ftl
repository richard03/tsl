<#import '/src/resources/freemarker/tsl.ftl' as tsl />


<@tsl.page title = "My Scripted Page">

	<@tsl.script url = "http://www.domain.com:123/js/testScript.js?v=4&amp;lang=cz" />

	<@tsl.script url = "anotherScript.js" id = "script2" />

	<@tsl.head>
		<@tsl.script url = "initScript.js" inline = true />

		<@tsl.script inline = true>
			start();
		</@tsl.script>
	</@tsl.head>


	<@tsl.body>
		before script

		<@tsl.script url = "bodyScript.js" inline = true />

		<@tsl.script inline = true>
			runInsideTheBody();
		</@tsl.script>

		after script

	</@tsl.body>
</@tsl.page>