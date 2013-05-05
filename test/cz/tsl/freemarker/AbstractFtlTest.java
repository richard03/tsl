package cz.tsl.freemarker;

/**
 * User: richard.sery
 * Date: 4.5.13
 * Time: 17:42
 */

import cz.tsl.AbstractTemplateTest;
import freemarker.template.Configuration;
import freemarker.template.Template;
import freemarker.template.TemplateException;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

import java.io.IOException;
import java.io.StringWriter;
import java.io.Writer;
import java.util.HashMap;
import java.util.Map;


/**
 * User: richard.sery
 * Date: 31.3.13
 * Time: 13:42
 */
@RunWith(JUnit4.class)
public abstract class AbstractFtlTest extends AbstractTemplateTest {

	public String readTemplate(String templateFilePath) throws IOException, TemplateException {

		Configuration cfg;
		cfg = new Configuration();

        // Build the data-model
        Map templateData = new HashMap();

		// TODO: initialize model

        // Get the template object
		Template template;
	    template = cfg.getTemplate(templateFilePath);

        Writer outputWriter = new StringWriter();

        // Merge the data-model and the template
		template.process(templateData, outputWriter);
		return outputWriter.toString();
	}

	public String getTemplatePath(String testName) {
		return "test/resources/" + testName + "Test.ftl";
	}

}