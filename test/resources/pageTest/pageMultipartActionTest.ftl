<#import '/src/resources/freemarker/tsl.ftl' as tsl />

<@tsl.page
		title = "Multipart Action Page"
		action = "http://www.domain.com/crapyAction.do?user-id=4&amp;product-id=45"
		multipart = true>
	<@tsl.body>
		Multipart actions are necessary to send files to the server using input type "field".
	</@tsl.body>
</@tsl.page>