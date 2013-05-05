package cz.tsl;

import org.custommonkey.xmlunit.Diff;
import org.xml.sax.SAXException;

import java.io.IOException;

/**
 * User: richard.sery
 * Date: 31.3.13
 * Time: 13:42
 */
public class XmlDiff {
	String testedXml;
	String targetXml;
	Diff diff;

	public XmlDiff(String testedXml, String targetXml) throws IOException, SAXException {
		this.testedXml = testedXml;
		this.targetXml = targetXml;
		diff = new Diff(testedXml.replaceAll("[\\s]{1,}", " ").trim(), targetXml.replaceAll("[\\s]{1,}", " ").trim());
	}

	public String getTestedXml() {
		return testedXml;
	}

	String getTargetXml() {
		return targetXml;
	}

	Diff getDiff() {
		return diff;
	}

	public String result() {
		return diff.toString();
	}

	public boolean passed() {
		return diff.similar();
	}

}
