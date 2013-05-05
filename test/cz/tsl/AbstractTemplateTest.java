package cz.tsl;

/**
 * User: richard.sery
 * Date: 4.5.13
 * Time: 17:42
 */

import freemarker.template.TemplateException;
import org.custommonkey.xmlunit.XMLUnit;
import org.junit.BeforeClass;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;
import org.xml.sax.SAXException;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.Charset;


/**
 * User: richard.sery
 * Date: 31.3.13
 * Time: 13:42
 */
@RunWith(JUnit4.class)
public abstract class AbstractTemplateTest {

	public String readFile(String filePath) throws IOException {
		FileInputStream fileStream = new FileInputStream(new File(filePath));
		try {
			FileChannel fileChannel = fileStream.getChannel();
			MappedByteBuffer fileBuffer = fileChannel.map(FileChannel.MapMode.READ_ONLY, 0, fileChannel.size());
			return Charset.defaultCharset().decode(fileBuffer).toString();
		} finally {
			fileStream.close();
		}
	}

	public abstract String readTemplate(String templateFilePath) throws IOException, TemplateException;

	public XmlDiff runTest(String testName) throws IOException, TemplateException, SAXException {
		String testedHtml = readTemplate(getTemplatePath(testName));
		String targetHtml = readFile(getTargetPath(testName));
		return new XmlDiff(testedHtml, targetHtml);
	}

	public abstract String getTemplatePath(String testName);

	public String getTargetPath(String testName) {
		return "test/resources/" + testName + "Test.html";
	}

	@BeforeClass
	public static void oneTimeSetUp() {
		XMLUnit.setIgnoreWhitespace(true);
	}

}