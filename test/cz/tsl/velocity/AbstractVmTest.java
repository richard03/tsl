package cz.tsl.velocity;

/**
 * User: richard.sery
 * Date: 4.5.13
 * Time: 17:42
 */

import cz.tsl.AbstractTemplateTest;
import freemarker.template.TemplateException;
import org.apache.velocity.VelocityContext;
import org.apache.velocity.app.VelocityEngine;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

import java.io.IOException;
import java.io.StringWriter;


/**
 * User: richard.sery
 * Date: 31.3.13
 * Time: 13:42
 */
@RunWith(JUnit4.class)
public abstract class AbstractVmTest extends AbstractTemplateTest {

	public String readTemplate(String templateFilePath) throws IOException, TemplateException {

        // first, get and initialize an engine
        VelocityEngine velocityEngine = new VelocityEngine();
        velocityEngine.init();

        // next, get the Template
        org.apache.velocity.Template template = velocityEngine.getTemplate(templateFilePath);

        // create a context and add data
        VelocityContext context = new VelocityContext();

		// TODO: initialize model

        // now render the template into a StringWriter
        StringWriter writer = new StringWriter();
        template.merge(context, writer);

        return writer.toString();
    }

	public String getTemplatePath(String testName) {
		return "test/resources/" + testName + "Test.vm";
	}

}