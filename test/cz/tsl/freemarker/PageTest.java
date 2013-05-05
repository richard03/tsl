package cz.tsl.freemarker;

import cz.tsl.XmlDiff;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

import static junit.framework.Assert.assertTrue;


/**
 * User: richard.sery
 * Date: 31.3.13
 * Time: 13:42
 */
@RunWith(JUnit4.class)
public class PageTest extends AbstractFtlTest {

    @Test
    public void pageTest() throws Exception {
		XmlDiff diff = runTest("pageTest/page");
		assertTrue(diff.result() + " FTL output: " + diff.getTestedXml(), diff.passed());
    }

	@Test
	public void pageMultipartActionTest() throws Exception {
		XmlDiff diff = runTest("pageTest/pageMultipartAction");
		assertTrue(diff.result() + " FTL output: " + diff.getTestedXml(), diff.passed());
	}

	@Test
	public void headTest() throws Exception {
		XmlDiff diff = runTest("pageTest/head");
		assertTrue(diff.result() + " FTL output: " + diff.getTestedXml(), diff.passed());
	}

	@Test
	public void bodyTest() throws Exception {
		XmlDiff diff = runTest("pageTest/body");
		assertTrue(diff.result() + " FTL output: " + diff.getTestedXml(), diff.passed());
	}

	@Test
	public void headAndBodyTest() throws Exception {
		XmlDiff diff = runTest("pageTest/headAndBody");
		assertTrue(diff.result() + " FTL output: " + diff.getTestedXml(), diff.passed());
	}

	@Test
	public void styleTest() throws Exception {
		XmlDiff diff = runTest("pageTest/style");
		assertTrue(diff.result() + " FTL output: " + diff.getTestedXml(), diff.passed());
	}

	@Test
	public void scriptTest() throws Exception {
		XmlDiff diff = runTest("pageTest/script");
		assertTrue(diff.result() + " FTL output: " + diff.getTestedXml(), diff.passed());
	}

}